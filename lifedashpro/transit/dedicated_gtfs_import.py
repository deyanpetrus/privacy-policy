#!/usr/bin/env python3
"""Load selected GTFS into the NEW dedicated LifeDashPro Transit Supabase project.

This does NOT support replacing a feed. It refuses the old LifeDashPro project,
nonempty dedicated tables, other projects, or unverified GTFS selections.
No 1.45M-row staging table: CSV rows are streamed with numeric-key mappings.
Runs as one transaction; a failed COPY/validation rolls back all writes.
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import os
import sys
from datetime import date, datetime, timezone, timedelta
from pathlib import Path
from urllib.parse import urlsplit

import psycopg
from psycopg.types.json import Jsonb

PROJECT_REF = "gnqtngtuzbxohgwgvmpb"
EXPECTED_FEED = "de-national"
EXPECTED_CITIES = {"regensburg", "munich", "nuremberg", "nittendorf"}
CORE_URL = "https://download.gtfs.de/germany/nv_free/latest.zip"
DB_SECRET = "LDP_DEDICATED_TRANSIT_DB_URL"
TABLES = ("feeds", "stops", "routes", "trips", "calendar",
          "calendar_dates", "shapes", "stop_times")
FILES = {
    "stops": ["feed_source","stop_id","stop_name","stop_code","parent_station","platform_code","stop_lat","stop_lon"],
    "routes": ["feed_source","route_id","agency_id","route_short_name","route_long_name","route_type","route_color","route_text_color"],
    "trips": ["feed_source","trip_id","route_id","service_id","trip_headsign","trip_short_name","direction_id","shape_id"],
    "calendar": ["feed_source","service_id","monday","tuesday","wednesday","thursday","friday","saturday","sunday","start_date","end_date"],
    "calendar_dates": ["feed_source","service_id","service_date","exception_type"],
    "shapes": ["feed_source","shape_id","shape_pt_sequence","shape_pt_lat","shape_pt_lon","shape_dist_traveled"],
    "stop_times": ["feed_source","trip_id","stop_sequence","stop_id","arrival_time","departure_time","arrival_secs","departure_secs","stop_headsign","pickup_type","drop_off_type"],
}

def verify_target(url: str) -> None:
    """No argument or URL can direct this utility toward original production."""
    parsed=urlsplit(url)
    if parsed.scheme not in ("postgres","postgresql") or not parsed.password:
        raise RuntimeError("Missing/invalid dedicated database connection URL")
    host=(parsed.hostname or "").lower()
    user=parsed.username or ""
    direct=host==f"db.{PROJECT_REF}.supabase.co" and user=="postgres"
    pooled=(host.endswith(".pooler.supabase.com") and
            user==f"postgres.{PROJECT_REF}")
    if not (direct or pooled) or parsed.path!="/postgres":
        raise RuntimeError("Safety stop: only the NEW dedicated Transit project is supported")
    if parsed.query and "sslmode=disable" in parsed.query.lower():
        raise RuntimeError("SSL must not be disabled")

def optional(value):
    return None if value is None or value=="" else value

def read_rows(folder: Path, name: str):
    with (folder/(name+".csv")).open("r",encoding="utf-8",newline="") as f:
        reader=csv.DictReader(f)
        if reader.fieldnames!=FILES[name]:
            raise RuntimeError("Unexpected CSV header for "+name)
        for row in reader:
            if row["feed_source"] != EXPECTED_FEED:
                raise RuntimeError("Unexpected feed ID in "+name)
            yield row

def check_manifest(folder:Path) -> dict:
    obj=json.loads((folder/"manifest.json").read_text(encoding="utf-8"))
    if obj.get("feed_source")!=EXPECTED_FEED:
        raise RuntimeError("Incorrect GTFS namespace")
    scope=obj.get("selection") or {}
    if set(x["id"] for x in scope.get("cities",[])) != EXPECTED_CITIES:
        raise RuntimeError("Safety stop: import only approved four-region core")
    if scope.get("radius_km") != 6 or scope.get("service_days") != 7:
        raise RuntimeError("Safety stop: incorrect GTFS radius/window")
    start=date.fromisoformat(scope["service_date"])
    today=datetime.now(timezone.utc).date()
    if not today-timedelta(days=1) <= start <= today+timedelta(days=1):
        raise RuntimeError("Safety stop: GTFS selection no longer current")
    counts=obj["counts"]
    if (counts.get("stops",0)<5000 or counts.get("routes",0)<200 or
            counts.get("trips",0)<35000 or
            not 500000 <= counts.get("stop_times",0) <= 2500000):
        raise RuntimeError("Safety stop: GTFS coverage is unexpected")
    files=obj.get("files",{})
    for name in FILES:
        p=folder/(name+".csv")
        if not p.is_file() or p.stat().st_size != files.get(p.name,{}).get("bytes"):
            raise RuntimeError("Missing/size-mismatched GTFS input: "+p.name)
    return obj

def stream_copy(cur, table, columns, row_iterator, expected):
    """Copy transformed compact records without PostgreSQL temp/staging heaps."""
    statement="copy transit_data."+table+" ("+",".join(columns)+") from stdin with (format csv)"
    n=0
    with cur.copy(statement) as cp:
        out=io.StringIO(newline="")
        writer=csv.writer(out,lineterminator="\n")
        for values in row_iterator:
            writer.writerow(values)
            n+=1
            if n%5000==0:
                cp.write(out.getvalue().encode("utf-8"))
                out.seek(0)
                out.truncate(0)
        if out.tell():
            cp.write(out.getvalue().encode("utf-8"))
    if n!=expected:
        raise RuntimeError("Input count mismatch "+table+": "+str(n)+" vs "+str(expected))
    print("Loaded",table,f"{n:,} rows",flush=True)

def require_empty(cur):
    cur.execute("select to_regnamespace('transit_data')")
    if cur.fetchone()[0] is None:
        raise RuntimeError("The new project's transit_data schema is missing")
    for table in TABLES:
        cur.execute("select exists (select 1 from transit_data."+table+" limit 1)")
        if cur.fetchone()[0]:
            raise RuntimeError("Safety stop: dedicated table already populated: "+table)

def mapping(cur,table,key_column,natural_column,expected):
    cur.execute("select "+natural_column+", "+key_column+
                " from transit_data."+table+" where feed_source=%s",(EXPECTED_FEED,))
    rows=cur.fetchall()
    if len(rows)!=expected:
        raise RuntimeError("Mapping count mismatch for "+table)
    result=dict(rows)
    if len(result)!=len(rows):
        raise RuntimeError("Duplicate identifier in "+table)
    return result

def run_import(cur,folder,manifest):
    counts=manifest["counts"]
    selection=manifest["selection"]
    start=date.fromisoformat(selection["service_date"])
    # Advertising the 14-day checked service range, not the 7-day seed selector.
    # The source guard has already verified >=1000 departures on every date.
    end=start+timedelta(days=13)
    cur.execute("""insert into transit_data.feeds
        (feed_source,feed_name,region,timezone,source_url,active,
         selected_from,selected_until,metadata)
        values (%s,%s,'Germany','Europe/Berlin',%s,false,%s,%s,%s)""",
        (EXPECTED_FEED,manifest.get("feed_name") or "Germany core",
         CORE_URL,start,end,Jsonb({
             "selection": selection,
             "counts":counts,
             "geometry":manifest.get("geometry",{}),
             "source_zip_bytes":manifest.get("source_zip_bytes")
         })))
    stream_copy(cur,"stops",FILES["stops"],
        ([optional(row[c]) for c in FILES["stops"]]
         for row in read_rows(folder,"stops")),counts["stops"])
    stop_ids=mapping(cur,"stops","stop_key","stop_id",counts["stops"])
    stream_copy(cur,"routes",FILES["routes"],
        ([optional(row[c]) for c in FILES["routes"]]
         for row in read_rows(folder,"routes")),counts["routes"])
    route_ids=mapping(cur,"routes","route_key","route_id",counts["routes"])
    def selected_trips():
        for row in read_rows(folder,"trips"):
            if row["route_id"] not in route_ids:
                raise RuntimeError("Missing referenced route in trips")
            yield (EXPECTED_FEED,row["trip_id"],route_ids[row["route_id"]],
                   optional(row["service_id"]),optional(row["trip_headsign"]),
                   optional(row["trip_short_name"]),optional(row["direction_id"]),
                   optional(row["shape_id"]))
    stream_copy(cur,"trips",
        ["feed_source","trip_id","route_key","service_id","trip_headsign",
         "trip_short_name","direction_id","shape_id"],selected_trips(),counts["trips"])
    trip_ids=mapping(cur,"trips","trip_key","trip_id",counts["trips"])
    for table in ("calendar","calendar_dates","shapes"):
        stream_copy(cur,table,FILES[table],
            ([optional(row[c]) for c in FILES[table]]
            for row in read_rows(folder,table)),
            counts["shape_points" if table=="shapes" else table])
    def selected_times():
        for row in read_rows(folder,"stop_times"):
            tid=trip_ids.get(row["trip_id"])
            sid=stop_ids.get(row["stop_id"])
            if tid is None or sid is None:
                raise RuntimeError("Unmatched trip/stop key in stop_times")
            yield (tid,optional(row["stop_sequence"]),sid,
                   optional(row["arrival_secs"]),optional(row["departure_secs"]),
                   optional(row["stop_headsign"]),optional(row["pickup_type"]),
                   optional(row["drop_off_type"]))
    stream_copy(cur,"stop_times",
        ["trip_key","stop_sequence","stop_key","arrival_secs","departure_secs",
         "stop_headsign","pickup_type","drop_off_type"],
        selected_times(),counts["stop_times"])
    for name in TABLES:
        if name=="feeds":
            continue
        cur.execute("select count(*) from transit_data."+name)
        expected=counts["shape_points" if name=="shapes" else name]
        if cur.fetchone()[0]!=expected:
            raise RuntimeError("Final row validation failed on "+name)
    cur.execute("""select count(*) from transit_data.trips t
        left join transit_data.routes r on r.route_key=t.route_key
        where r.route_key is null""")
    if cur.fetchone()[0]:
        raise RuntimeError("Unresolved trip-route references")
    cur.execute("""select count(*) from transit_data.stop_times st
        where st.stop_sequence is null or
        (st.departure_secs is null and st.arrival_secs is null)""")
    if cur.fetchone()[0] > counts["stop_times"]//100:
        raise RuntimeError("Excessive missing schedule times")
    cur.execute("select pg_database_size(current_database())")
    size=cur.fetchone()[0]
    if size > 390*1024*1024:
        raise RuntimeError("Free project quota guard: database exceeds 390 MiB")
    cur.execute("""update transit_data.feeds set active=true
        where feed_source=%s and active=false""",(EXPECTED_FEED,))
    if cur.rowcount!=1:
        raise RuntimeError("Feed activation failed")
    return {"feed_source":EXPECTED_FEED,"dates":[str(start),str(end)],
            "counts":counts,"db_size_mib":round(size/1048576,2),"active":True}

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--dir",type=Path,required=True)
    ap.add_argument("--confirm-project-ref",required=True)
    args=ap.parse_args()
    if args.confirm_project_ref!=PROJECT_REF:
        raise RuntimeError("Wrong destination reference")
    if os.environ.get("LDP_TRANSIT_DB_URL"):
        raise RuntimeError("Old production connection secret must never be present")
    manifest=check_manifest(args.dir)
    url=os.environ.get(DB_SECRET,"")
    verify_target(url)
    # Do not print a connection string or its password.
    with psycopg.connect(url,sslmode="require",connect_timeout=15,
                         autocommit=False) as db:
        try:
            with db.cursor() as cur:
                require_empty(cur)
                report=run_import(cur,args.dir,manifest)
            db.commit()
        except Exception:
            db.rollback()
            raise
    print("DEDICATED_TRANSIT_IMPORT_PASS",json.dumps(report,ensure_ascii=False),
          flush=True)
    return 0

if __name__=="__main__":
    try:
        raise SystemExit(main())
    except Exception as e:
        # Errors from psycopg may include parts of a connection string.
        # Show a generic error; GitHub's step fails and project remains unchanged.
        print("DEDICATED_TRANSIT_IMPORT_FAILED: validation or transaction failed; "
              "verify input/project connectivity without sharing credentials.",
              file=sys.stderr)
        raise SystemExit(1) from None
