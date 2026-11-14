#!/usr/bin/env python3
"""Compact, fail-closed Sofia / Germany regional-rail GTFS cache for NEW Transit only.

Never touches the old LifeDashPro project or transit_data.de-national.
Each source uses its own existing transit_next A/B stop and departure slots.
Default dry-run inspects the official feed but does not write to Supabase.
"""
from __future__ import annotations
import argparse
import csv
import io
import json
import math
import os
import re
import sys
import urllib.request
import zipfile
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from tempfile import TemporaryDirectory
from zoneinfo import ZoneInfo

import psycopg
from psycopg.types.json import Jsonb
from dedicated_gtfs_import import verify_target

TARGET = "gnqtngtuzbxohgwgvmpb"
SECRET_NAME = "LDP_DEDICATED_TRANSIT_DB_URL"
MAX_DB_BYTES = 390 * 1048576  # margin below the Supabase Free 500 MB DB limit
MAX_PAYLOAD_BYTES = 42 * 1048576  # each feed, compact encoded JSON
MAX_TOTAL_EVENTS = 280000
MAX_ZIP_EXPANDED = 900 * 1048576
SOURCES = {
    "sofia": {
        "url": "https://gtfs.sofiatraffic.bg/api/v1/static",
        "zip_max": 80000000, "timezone": "Europe/Sofia",
        "max_stops": 6500, "minimum_stops": 1500,
        "modes": {"0": "tram", "1": "subway", "3": "bus"},
        "geo": (42.35, 43.05, 22.7, 24.2),
    },
    "rail": {
        "url": "https://download.gtfs.de/germany/rv_free/latest.zip",
        "zip_max": 45000000, "timezone": "Europe/Berlin",
        "max_stops": 4000, "minimum_stops": 40,
        "modes": {"2": "train", "100": "train", "101": "train", "102": "train",
                  "103": "train", "106": "train", "107": "train", "109": "suburban"},
        "geo": (47, 55.3, 5, 16),
    },
}
# Small measured free-tier railway footprint; never claim whole-country coverage.
RAIL_CENTERS = (
    (49.0134,12.1016),  # Regensburg
    (48.1374,11.5755),  # Munich
    (49.4521,11.0767),  # Nürnberg
    (49.0240,11.9610),  # Nittendorf
    (53.0758,8.8072),  # Bremen
)
def distance_km(a,b,c,d):
    p=math.pi/180
    x=math.sin((c-a)*p/2)**2+math.cos(a*p)*math.cos(c*p)*math.sin((d-b)*p/2)**2
    return 12742.016*math.asin(math.sqrt(min(1.0,x)))

def inside(feed,lat,lon):
    a,b,c,d=SOURCES[feed]["geo"]
    if not(a<=lat<=b and c<=lon<=d):return False
    if feed=="sofia":return True
    return any(distance_km(lat,lon,x,y)<=18 for x,y in RAIL_CENTERS)

def archive(url,path,limit):
    req=urllib.request.Request(url,headers={"User-Agent":"LifeDashPro-Transit-Cache/1.0","Accept":"application/zip"})
    with urllib.request.urlopen(req,timeout=90) as resp,open(path,"wb") as out:
        if int(resp.headers.get("Content-Length") or 0)>limit:raise RuntimeError("ZIP_CONTENT_LENGTH_OVER_CAP")
        size=0
        while True:
            b=resp.read(1048576)
            if not b:break
            size+=len(b)
            if size>limit:raise RuntimeError("ZIP_BYTES_OVER_CAP")
            out.write(b)
    if size<1000000:raise RuntimeError("ZIP_TOO_SMALL")
    return size

def read_rows(z,name):
    with z.open(name) as raw:
        reader=csv.DictReader(io.TextIOWrapper(raw,encoding="utf-8-sig",newline=""))
        yield from reader

def parse_gtfs_date(s):
    try:return datetime.strptime(s,"%Y%m%d").date()
    except (ValueError,TypeError):return None

def parse_secs(s):
    try:
        vals=list(map(int,s.split(":")))
        if len(vals)!=3 or vals[0]<0 or not 0<=vals[1]<60 or not 0<=vals[2]<60:return None
        return vals[0]*3600+vals[1]*60+vals[2]
    except (ValueError,AttributeError):return None

def calendar_services(z,dates):
    active={d:set() for d in dates}
    if "calendar.txt" in z.namelist():
        for row in read_rows(z,"calendar.txt"):
            start,end=parse_gtfs_date(row.get("start_date")),parse_gtfs_date(row.get("end_date"))
            if not start or not end:continue
            for d in dates:
                if start<=d<=end and row.get(
                    ("monday","tuesday","wednesday","thursday","friday","saturday","sunday")[d.weekday()]
                )=="1":active[d].add(row.get("service_id",""))
    if "calendar_dates.txt" in z.namelist():
        for row in read_rows(z,"calendar_dates.txt"):
            d=parse_gtfs_date(row.get("date"))
            if d not in active:continue
            sid=row.get("service_id","")
            if row.get("exception_type")=="1":active[d].add(sid)
            elif row.get("exception_type")=="2":active[d].discard(sid)
    if not any(active.values()):raise RuntimeError("NO_ACTIVE_SERVICE_DATES")
    return active

def build(feed,archive_path):
    config=SOURCES[feed]
    now=datetime.now(ZoneInfo(config["timezone"]))
    days=[now.date(),now.date()+timedelta(days=1)]
    with zipfile.ZipFile(archive_path) as z:
        required={"stops.txt","routes.txt","trips.txt","stop_times.txt"}
        if required-set(z.namelist()):raise RuntimeError("GTFS_MISSING_MANDATORY_FILES")
        if sum(x.file_size for x in z.infolist())>MAX_ZIP_EXPANDED:
            raise RuntimeError("ZIP_EXPANDED_TOO_LARGE")
        services=calendar_services(z,days)
        stops={}
        for s in read_rows(z,"stops.txt"):
            try:lat,lon=float(s.get("stop_lat","")),float(s.get("stop_lon",""))
            except (ValueError,TypeError):continue
            if not math.isfinite(lat) or not math.isfinite(lon) or not inside(feed,lat,lon):continue
            sid=s.get("stop_id","").strip()
            if sid:
                stops[sid]={"stop_id":sid,"name":s.get("stop_name") or sid,"lat":lat,"lon":lon,
                            "platform":s.get("platform_code") or None,"lines":set(),"modes":set()}
            if len(stops)>config["max_stops"]:raise RuntimeError("STOP_COUNT_OVER_APPROVED_CAP")
        routes={}
        for r in read_rows(z,"routes.txt"):
            mode=config["modes"].get(str(r.get("route_type","")))
            if mode:
                line=(r.get("route_short_name") or r.get("route_long_name") or r.get("route_id") or "")[:90]
                if feed=="rail" and re.fullmatch(r"S\d{1,3}[A-Za-z]?",line.strip(),re.I):
                    mode="suburban"
                routes[r.get("route_id","")]={"line":line,"mode":mode}
        triples={}
        for t in read_rows(z,"trips.txt"):
            route=routes.get(t.get("route_id",""))
            if not route:continue
            valid=[d for d in days if t.get("service_id") in services[d]]
            if valid:
                triples[t["trip_id"]]={"route":route,"headsign":(t.get("trip_headsign") or t.get("trip_short_name") or "")[:110],"days":valid}
        events=defaultdict(list)
        total=0
        for st in read_rows(z,"stop_times.txt"):
            tid=st.get("trip_id","")
            trip=triples.get(tid)
            sid=st.get("stop_id","")
            if not trip or sid not in stops:continue
            secs=parse_secs(st.get("departure_time") or st.get("arrival_time"))
            if secs is None:continue
            r=trip["route"];s=stops[sid]
            s["lines"].add(r["line"]);s["modes"].add(r["mode"])
            for d in trip["days"]:
                # Free-tier rolling horizon. Include today's late services and tomorrow's
                # early services (including GTFS 24:xx times) without two full days.
                occurrence=datetime(d.year,d.month,d.day,tzinfo=now.tzinfo)+timedelta(seconds=secs)
                if not now-timedelta(minutes=5)<=occurrence<=now+timedelta(hours=24):continue
                events[(sid,d)].append({
                    "tripId":tid[:130],"line":r["line"],"direction":(st.get("stop_headsign") or trip["headsign"])[:110],
                    "mode":r["mode"],"time":f"{secs//3600:02d}:{secs//60%60:02d}",
                    "departureSecs":secs
                })
                total+=1
                if total>MAX_TOTAL_EVENTS:raise RuntimeError("TOTAL_DEPARTURES_OVER_APPROVED_CAP")
    # Retain only actual station/stop locations with a service in this 2-day period.
    served={sid for sid,d in events}
    active_stops=[]
    for sid in sorted(served):
        s=stops[sid]
        mode="subway" if "subway" in s["modes"] else ("tram" if "tram" in s["modes"] else (
            "bus" if "bus" in s["modes"] else ("suburban" if "suburban" in s["modes"] else "train")))
        active_stops.append((sid,s["name"],s["lat"],s["lon"],s["platform"],mode,sorted(s["lines"])[:75]))
    if len(active_stops)<config["minimum_stops"] or total<1000:
        raise RuntimeError("VALIDATED_FEED_TOO_SMALL")
    rows=[]
    size=0
    for sid,d in sorted(events):
        payload=sorted(events[(sid,d)],key=lambda x:(x["departureSecs"],x["tripId"]))
        serialized=json.dumps(payload,ensure_ascii=False,separators=(",",":"))
        size+=len(serialized.encode("utf-8"))
        if size>MAX_PAYLOAD_BYTES:raise RuntimeError("JSON_PAYLOAD_OVER_APPROVED_CAP")
        rows.append((sid,d,serialized))
    return active_stops,rows,{"feed":feed,"days":[str(x) for x in days],
        "stops":len(active_stops),"departures":total,"stop_day_rows":len(rows),
        "payload_mib":round(size/1048576,2)}

def snapshot(cur,kind):
    cur.execute("select active_slot,loaded_at,expires_at from transit_next."+kind+"_meta where id=1")
    x=cur.fetchone()
    if not x or x[0] not in ("a","b"):raise RuntimeError("META_MISSING")
    return x

def write(feed,stop_rows,departure_rows,stats):
    url=os.getenv(SECRET_NAME,"")
    verify_target(url) # hard-bound to NEW dedicated project only
    kind="sofia" if feed=="sofia" else "rail"
    with psycopg.connect(url,connect_timeout=20,sslmode="require") as db:
        with db.transaction():
            with db.cursor() as cur:
                cur.execute("select current_database(),current_user")
                if cur.fetchone()!=("postgres","postgres"):raise RuntimeError("WRONG_DATABASE_ROLE")
                cur.execute("select pg_try_advisory_xact_lock(820617,20261017)")
                if cur.fetchone()[0] is not True:raise RuntimeError("OTHER_DEDICATED_TRANSIT_IMPORT_RUNNING")
                cur.execute("select pg_database_size(current_database())")
                before=cur.fetchone()[0]
                if before>340*1048576:raise RuntimeError("DATABASE_TOO_BIG_FOR_SAFE_FREE_REFRESH")
                old,loaded,expires=snapshot(cur,kind)
                if loaded and loaded > datetime.now(loaded.tzinfo)-timedelta(hours=12) and expires and expires>datetime.now(expires.tzinfo)+timedelta(hours=12):
                    print(json.dumps({"status":"fresh_skip","feed":feed,"stops":len(stop_rows),"db_before_mib":round(before/1048576,2)}))
                    return
                inactive="b" if old=="a" else "a"
                stops_table="transit_next."+kind+"_stops_"+inactive
                departures_table="transit_next."+kind+"_departures_"+inactive
                # Only the inactive per-source slot is replaced.
                cur.execute("truncate table "+departures_table+", "+stops_table)
                stop_sql="insert into "+stops_table+" (stop_id,name,lat,lon,platform,mode,lines) values (%s,%s,%s,%s,%s,%s,%s)"
                cur.executemany(stop_sql,stop_rows)
                dep_sql="insert into "+departures_table+" (stop_id,service_date,payload) values (%s,%s,%s)"
                cur.executemany(dep_sql,[(sid,d,Jsonb(json.loads(raw))) for sid,d,raw in departure_rows])
                cur.execute("select count(*) from "+stops_table)
                if cur.fetchone()[0]!=len(stop_rows):raise RuntimeError("POST_IMPORT_STOP_COUNT_MISMATCH")
                cur.execute("select count(*) from "+departures_table)
                if cur.fetchone()[0]!=len(departure_rows):raise RuntimeError("POST_IMPORT_DEPARTURE_COUNT_MISMATCH")
                cur.execute("select pg_database_size(current_database())")
                after=cur.fetchone()[0]
                if after>MAX_DB_BYTES:raise RuntimeError("FREE_PROJECT_QUOTA_GUARD_ROLLBACK")
                cur.execute("update transit_next."+kind+"_meta set active_slot=%s,loaded_at=now(),expires_at=now()+interval '35 hours',stops=%s,departures=%s where id=1",
                            (inactive,len(stop_rows),stats["departures"]))
                if cur.rowcount!=1:raise RuntimeError("META_FLIP_FAILED")
                cur.execute("update transit_next.feed_registry set integration_state='enabled',last_checked_at=now(),note=concat_ws(' | ',note,'Free compact two-day GTFS slot cache; scheduled only; size gated') where feed_id=%s",
                            ("bg-sofia" if feed=="sofia" else "de-regional-rail",))
                print(json.dumps({"status":"ready_to_commit","stats":stats,"active_slot":inactive,
                                  "db_before_mib":round(before/1048576,2),"db_after_mib":round(after/1048576,2)}))
        print(json.dumps({"status":"COMMITTED","feed":feed,"stops":len(stop_rows),"departures":stats["departures"]}))

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--feed",choices=("sofia","rail"),required=True)
    parser.add_argument("--mode",choices=("plan","refresh"),default="plan")
    parser.add_argument("--confirm-project-ref",default="")
    args=parser.parse_args()
    if args.mode=="refresh" and args.confirm_project_ref!=TARGET:
        raise SystemExit("REFRESH_TARGET_REF_MISMATCH")
    with TemporaryDirectory(prefix="transit-next-") as tmp:
        p=Path(tmp)/"download.zip"
        downloaded=archive(SOURCES[args.feed]["url"],p,SOURCES[args.feed]["zip_max"])
        stops,departures,stats=build(args.feed,p)
        stats["zip_mib"]=round(downloaded/1048576,2)
        print(json.dumps({"status":"SOURCE_VERIFIED","mode":args.mode,**stats}))
        if args.mode=="refresh":write(args.feed,stops,departures,stats)
if __name__=="__main__":
    try:main()
    except Exception as e:
        # Do not print connection strings, source URLs with credentials, or exception internals.
        print("SAFE_IMPORT_STOP "+(str(e) if isinstance(e,RuntimeError) else type(e).__name__),file=sys.stderr)
        raise SystemExit(1)
