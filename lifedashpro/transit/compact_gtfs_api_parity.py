#!/usr/bin/env python3
"""Full GTFS RPC semantic parity on isolated, disposable PostgreSQL only.

Run *after* compact_gtfs_benchmark.py on the SAME GitHub runner database.
Adds routes/calendars/exceptions/shapes to both schemas and checks:
- all service calendar decisions (including exceptions)
- nearby station lookups in four Bavarian cities
- scheduled departures on weekday/weekend, plus previous-day 24h+ handling
- complete trip stop paths, names, times, routes and approximate geometry
No Supabase credentials, DDL, or production connections are ever used.
"""
from __future__ import annotations

import argparse
import json
import os
import statistics
import time
from datetime import date, timedelta
from pathlib import Path

import psycopg

from compact_gtfs_benchmark import validate_local_url, EXPECTED_DB, EXPECTED_USER

FILES = {
    "routes": ("routes.csv", """feed_source,route_id,agency_id,route_short_name,route_long_name,
        route_type,route_color,route_text_color"""),
    "calendar": ("calendar.csv", """feed_source,service_id,monday,tuesday,wednesday,
        thursday,friday,saturday,sunday,start_date,end_date"""),
    "calendar_dates": ("calendar_dates.csv", """feed_source,service_id,service_date,exception_type"""),
    "shapes": ("shapes.csv", """feed_source,shape_id,shape_pt_sequence,shape_pt_lat,
        shape_pt_lon,shape_dist_traveled""")
}

DDL = """
create table {s}.routes (
    feed_source text not null, route_id text not null, agency_id text,
    route_short_name text, route_long_name text, route_type integer,
    route_color text, route_text_color text,
    primary key (feed_source, route_id));
create table {s}.calendar (
    feed_source text not null, service_id text not null,
    monday boolean, tuesday boolean, wednesday boolean, thursday boolean,
    friday boolean, saturday boolean, sunday boolean,
    start_date date, end_date date, primary key(feed_source,service_id));
create table {s}.calendar_dates (
    feed_source text not null, service_id text not null, service_date date not null,
    exception_type integer, primary key(feed_source,service_id,service_date));
create table {s}.shapes (
    feed_source text not null, shape_id text not null,
    shape_pt_sequence integer not null, shape_pt_lat double precision,
    shape_pt_lon double precision, shape_dist_traveled double precision,
    primary key(feed_source,shape_id,shape_pt_sequence));
"""

FUNCTION = """
create function {s}.service_active(feed text, service text, day date)
returns boolean language sql stable as $$
    select coalesce(
        (select case when cd.exception_type=1 then true
                     when cd.exception_type=2 then false else null end
         from {s}.calendar_dates cd where cd.feed_source=feed
         and cd.service_id=service and cd.service_date=day),
        (select (day between c.start_date and c.end_date) and
            case extract(isodow from day)::int
                when 1 then c.monday when 2 then c.tuesday when 3 then c.wednesday
                when 4 then c.thursday when 5 then c.friday when 6 then c.saturday
                when 7 then c.sunday else false end
         from {s}.calendar c where c.feed_source=feed and c.service_id=service),
        false)
$$;
"""

NEARBY = """
with candidates as (
    select s.feed_source || ':' || s.stop_id as scoped_id,
        s.stop_name,s.stop_code,s.platform_code,s.stop_lat,s.stop_lon,
        round(2*6371000*asin(sqrt(
          power(sin(radians(s.stop_lat-%s)/2),2)
          + cos(radians(%s))*cos(radians(s.stop_lat))
          * power(sin(radians(s.stop_lon-%s)/2),2)
        )))::integer distance_m,
        s.stop_id
    from {s}.stops s where s.feed_source='de-national'
    and s.stop_lat between %s - (%s/111320.0) and %s + (%s/111320.0)
    and s.stop_lon between %s - (%s/greatest(1000.0,111320.0*cos(radians(%s))))
                       and %s + (%s/greatest(1000.0,111320.0*cos(radians(%s))))
)
select scoped_id,stop_name,stop_code,platform_code,stop_lat,stop_lon,distance_m
from candidates where distance_m <=%s
order by distance_m,stop_id limit 40;
"""

RAW_DEPS = """
with departures as (
    select st.feed_source,st.trip_id,t.route_id,
      coalesce(nullif(r.route_short_name,''),nullif(r.route_long_name,''),t.route_id) as line,
      coalesce(nullif(t.trip_headsign,''),nullif(t.trip_short_name,''),'—') as direction,
      %s::date as service_date,
      coalesce(st.departure_secs,st.arrival_secs) as departure_secs,
      coalesce(st.departure_secs,st.arrival_secs) as display_seconds,
      s.platform_code
    from legacy_bench.stop_times st
    join legacy_bench.trips t on t.feed_source=st.feed_source and t.trip_id=st.trip_id
    join legacy_bench.routes r on r.feed_source=t.feed_source and r.route_id=t.route_id
    join legacy_bench.stops s on s.feed_source=st.feed_source and s.stop_id=st.stop_id
    where st.feed_source='de-national' and st.stop_id=%s
      and coalesce(st.departure_secs,st.arrival_secs) between %s and %s
      and legacy_bench.service_active(t.feed_source,t.service_id,%s)
    union all
    select st.feed_source,st.trip_id,t.route_id,
      coalesce(nullif(r.route_short_name,''),nullif(r.route_long_name,''),t.route_id),
      coalesce(nullif(t.trip_headsign,''),nullif(t.trip_short_name,''),'—'),
      (%s::date - 1),coalesce(st.departure_secs,st.arrival_secs),
      coalesce(st.departure_secs,st.arrival_secs)-86400,
      s.platform_code
    from legacy_bench.stop_times st
    join legacy_bench.trips t on t.feed_source=st.feed_source and t.trip_id=st.trip_id
    join legacy_bench.routes r on r.feed_source=t.feed_source and r.route_id=t.route_id
    join legacy_bench.stops s on s.feed_source=st.feed_source and s.stop_id=st.stop_id
    where st.feed_source='de-national' and st.stop_id=%s
      and coalesce(st.departure_secs,st.arrival_secs) between %s and %s
      and legacy_bench.service_active(t.feed_source,t.service_id,%s::date-1)
)
select * from departures order by display_seconds,trip_id limit 100;
"""

COMPACT_DEPS = """
with departures as (
    select tm.feed_source,tm.trip_id,tm.route_id,
      coalesce(nullif(r.route_short_name,''),nullif(r.route_long_name,''),tm.route_id) as line,
      coalesce(nullif(tm.trip_headsign,''),nullif(tm.trip_short_name,''),'—') as direction,
      %s::date as service_date,
      coalesce(st.departure_secs,st.arrival_secs) as departure_secs,
      coalesce(st.departure_secs,st.arrival_secs) as display_seconds,
      s.platform_code
    from compact_bench.stops s
    join compact_bench.stop_times st on st.stop_key=s.stop_key
    join compact_bench.trips tm on tm.trip_key=st.trip_key
    join compact_bench.routes r on r.feed_source=tm.feed_source and r.route_id=tm.route_id
    where s.feed_source='de-national' and s.stop_id=%s
      and coalesce(st.departure_secs,st.arrival_secs) between %s and %s
      and compact_bench.service_active(tm.feed_source,tm.service_id,%s)
    union all
    select tm.feed_source,tm.trip_id,tm.route_id,
      coalesce(nullif(r.route_short_name,''),nullif(r.route_long_name,''),tm.route_id),
      coalesce(nullif(tm.trip_headsign,''),nullif(tm.trip_short_name,''),'—'),
      (%s::date - 1),coalesce(st.departure_secs,st.arrival_secs),
      coalesce(st.departure_secs,st.arrival_secs)-86400,
      s.platform_code
    from compact_bench.stops s
    join compact_bench.stop_times st on st.stop_key=s.stop_key
    join compact_bench.trips tm on tm.trip_key=st.trip_key
    join compact_bench.routes r on r.feed_source=tm.feed_source and r.route_id=tm.route_id
    where s.feed_source='de-national' and s.stop_id=%s
      and coalesce(st.departure_secs,st.arrival_secs) between %s and %s
      and compact_bench.service_active(tm.feed_source,tm.service_id,%s::date-1)
)
select * from departures order by display_seconds,trip_id limit 100;
"""

RAW_TRIP = """
select t.trip_id,t.route_id,t.trip_headsign,t.trip_short_name,t.shape_id,
       st.stop_sequence,s.stop_id,s.stop_name,s.stop_lat,s.stop_lon,
       st.arrival_secs,st.departure_secs,st.arrival_time,st.departure_time,
       s.platform_code
from legacy_bench.trips t
join legacy_bench.stop_times st on st.feed_source=t.feed_source and st.trip_id=t.trip_id
join legacy_bench.stops s on s.feed_source=st.feed_source and s.stop_id=st.stop_id
where t.feed_source='de-national' and t.trip_id=%s
order by st.stop_sequence;
"""
COMPACT_TRIP = """
select t.trip_id,t.route_id,t.trip_headsign,t.trip_short_name,t.shape_id,
       st.stop_sequence,s.stop_id,s.stop_name,s.stop_lat,s.stop_lon,
       st.arrival_secs,st.departure_secs,s.platform_code
from compact_bench.trips t
join compact_bench.stop_times st on st.trip_key=t.trip_key
join compact_bench.stops s on s.stop_key=st.stop_key
where t.feed_source='de-national' and t.trip_id=%s
order by st.stop_sequence;
"""

def clock(secs):
    if secs is None:
        return None
    return f"{secs//3600:02}:{(secs//60)%60:02}:{secs%60:02}"

def run(cur, statement, params=()):
    t=time.perf_counter()
    cur.execute(statement,params)
    return cur.fetchall(),round((time.perf_counter()-t)*1000,3)

def create_full_schema(cur, folder, counts):
    for schema in ("legacy_bench","compact_bench"):
        cur.execute(DDL.format(s=schema))
        cur.execute(FUNCTION.format(s=schema))
        for table,(filename,columns) in FILES.items():
            if schema=="legacy_bench":
                with cur.copy("COPY legacy_bench."+table+" ("+columns+
                              ") FROM STDIN WITH (FORMAT CSV, HEADER TRUE)") as w:
                    with (folder/filename).open("rb") as f:
                        while chunk:=f.read(1048576):
                            w.write(chunk)
            else:
                cur.execute("insert into compact_bench."+table+
                            " select * from legacy_bench."+table)
            cur.execute("select count(*) from "+schema+"."+table)
            actual=cur.fetchone()[0]
            expected=int(counts["shape_points" if table=="shapes" else table])
            if actual!=expected:
                raise RuntimeError(f"{schema}.{table} count mismatch: {actual} vs {expected}")
            cur.execute("analyze "+schema+"."+table)
    # Ensure all trip route codes are resolvable.
    cur.execute("""select count(*) from compact_bench.trips t
        left join compact_bench.routes r on r.feed_source=t.feed_source
          and r.route_id=t.route_id where r.route_id is null""")
    if cur.fetchone()[0]:
        raise RuntimeError("Compact GTFS has trips whose route metadata is missing")
    for table in FILES:
        cur.execute("select count(*) from (select * from legacy_bench."+table+
                    " except all select * from compact_bench."+table+") z")
        if cur.fetchone()[0]:
            raise RuntimeError("Full metadata differs for "+table)

def check_service_calendar(cur, service_start):
    days=[service_start+timedelta(days=n) for n in range(14)]
    cur.execute("""select service_id from legacy_bench.calendar
        union select service_id from legacy_bench.calendar_dates
        order by service_id""")
    services=[x[0] for x in cur.fetchall()]
    if len(services)<20:
        raise RuntimeError("Too few calendar service IDs")
    decisions=0
    active_by_day={}
    # One query for all combinations in each schema; identical dates and
    # exception precedence must match actual Supabase service_active behavior.
    for day in days:
        active_counts=[]
        snapshots=[]
        for schema in ("legacy_bench","compact_bench"):
            res,_=run(cur, "select service_id, "+schema+
                ".service_active('de-national',service_id,%s) from (select service_id from "+
                schema+".calendar union select service_id from "+schema+
                ".calendar_dates) c order by service_id",(day,))
            snapshots.append(res)
            active_counts.append(sum(bool(row[1]) for row in res))
        if snapshots[0]!=snapshots[1]:
            raise RuntimeError("GTFS calendar / exceptions differ on "+str(day))
        if active_counts[0]==0:
            raise RuntimeError("No GTFS services active on "+str(day))
        decisions+=len(snapshots[0])
        active_by_day[str(day)]=active_counts[0]
    return decisions,active_by_day

def check_nearby(cur):
    cities=[("Regensburg",49.0134,12.1016),("Munich",48.1374,11.5755),
            ("Nurnberg",49.4521,11.0767),("Nittendorf",49.024,11.961)]
    examples=[]
    for city,lat,lon in cities:
        for radius in (1500,5000):
            # parameter order exactly matches NEARBY's parameterized bounding box
            params=(lat,lat,lon,lat,radius,lat,radius,
                    lon,radius,lat,lon,radius,lat,radius)
            a,_=run(cur,NEARBY.format(s="legacy_bench"),params)
            b,_=run(cur,NEARBY.format(s="compact_bench"),params)
            if a!=b: raise RuntimeError("nearby RPC differs in "+city+"/"+str(radius))
            if not a: raise RuntimeError("No nearby GTFS stops in "+city)
            examples.append({"city":city,"radius_m":radius,"returned":len(a)})
    return examples

def check_departures(cur,manifest):
    start=date.fromisoformat(manifest["selection"]["service_date"])
    days=[start+timedelta(days=n) for n in (0,1,2,4,6,9,13)]
    # Five busy stations and main railway station if a matching name exists.
    cur.execute("""select stop_id from legacy_bench.stop_times
        group by stop_id order by count(*) desc,stop_id limit 5""")
    stops=[x[0] for x in cur.fetchall()]
    cur.execute("""select stop_id from legacy_bench.stops where
        lower(stop_name) like '%regensburg%' and lower(stop_name) like '%hbf%'
        order by stop_id limit 1""")
    hbf=cur.fetchone()
    if hbf and hbf[0] not in stops: stops.append(hbf[0])
    if not stops: raise RuntimeError("No GTFS test stops")
    tested=0
    positive=0
    times_legacy=[]
    times_compact=[]
    for day in days:
        for sid in stops:
            for now in (0,43200,70000,84000):
                end=now+3*3600
                params=(day,sid,now,end,day,day,sid,86400+now,86400+end,day)
                raw,legacy_ms=run(cur,RAW_DEPS,params)
                compact,compact_ms=run(cur,COMPACT_DEPS,params)
                if raw!=compact:
                    raise RuntimeError(f"GTFS departures RPC mismatch: {sid} {day} {now}")
                positive+=bool(raw)
                times_legacy.append(legacy_ms)
                times_compact.append(compact_ms)
                tested+=1
    if positive<20:
        raise RuntimeError("Too few nonempty departure test cases: "+str(positive))
    # Exercise an actual after-midnight scheduled trip if the source has one.
    # Report absence explicitly rather than falsely claiming 24h+ coverage.
    cur.execute("""select st.stop_id,st.departure_secs,t.service_id,t.trip_id
        from legacy_bench.stop_times st
        join legacy_bench.trips t on t.feed_source=st.feed_source
            and t.trip_id=st.trip_id
        where st.departure_secs between 86400 and 100799
        order by st.departure_secs,st.stop_id limit 150""")
    candidates=cur.fetchall()
    overflow_status="no 24h+ trips in selected candidates"
    for candidate_stop,candidate_sec,service_id,trip_id in candidates:
        chosen=None
        for service_date in [start+timedelta(days=x) for x in range(13)]:
            cur.execute("select legacy_bench.service_active('de-national',%s,%s)",
                        (service_id,service_date))
            if cur.fetchone()[0]:
                chosen=service_date+timedelta(days=1)
                break
        if chosen is None:
            continue
        now=candidate_sec-86400
        lookahead=now+600
        params=(chosen,candidate_stop,now,lookahead,chosen,
                chosen,candidate_stop,86400+now,86400+lookahead,chosen)
        old,_=run(cur,RAW_DEPS,params)
        new,_=run(cur,COMPACT_DEPS,params)
        if old!=new or not any(record[1]==trip_id for record in old):
            raise RuntimeError("Previous-service-day / 24h+ departures mismatch")
        overflow_status=f"checked {trip_id} on {chosen.isoformat()} after midnight"
        break
    return {"checks":tested,"nonempty_windows":positive,
            "after_midnight_24h_plus":overflow_status,
            "median_old_ms":round(statistics.median(times_legacy),3),
            "median_compact_ms":round(statistics.median(times_compact),3),
            "regensburg_hbf_stop_id":hbf[0] if hbf else None}

def check_trip_routes(cur):
    cur.execute("""select trip_id from legacy_bench.stop_times
        group by trip_id order by count(*) desc,trip_id limit 12""")
    ids=[x[0] for x in cur.fetchall()]
    cur.execute("select trip_id from legacy_bench.trips order by md5(trip_id) limit 12")
    ids=list(dict.fromkeys(ids+[x[0] for x in cur.fetchall()]))
    checked=0
    for tid in ids:
        old,_=run(cur,RAW_TRIP,(tid,))
        new,_=run(cur,COMPACT_TRIP,(tid,))
        transformed=[]
        for row in new:
            transformed.append((*row[:12],clock(row[10]),clock(row[11]),row[12]))
        if old!=transformed:
            raise RuntimeError("GTFS trip route stop geometry/time mismatch: "+tid)
        if len(old)<2:
            raise RuntimeError("Trip with no meaningful stop path: "+tid)
        checked+=1
    return checked

def get_sizes(cur):
    output={}
    for schema in ("legacy_bench","compact_bench"):
        r={}
        for table in ("stops","trips","stop_times",*FILES.keys()):
            cur.execute("select pg_total_relation_size(%s::regclass)",
                        (schema+"."+table,))
            r[table]=round(cur.fetchone()[0]/1048576,2)
        output[schema]={"tables":r,"total_mb":round(sum(r.values()),2)}
    return output

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--dir",type=Path,required=True)
    ap.add_argument("--db-url",required=True)
    ap.add_argument("--report",type=Path,required=True)
    args=ap.parse_args()
    validate_local_url(args.db_url)
    if os.environ.get("LDP_TRANSIT_DB_URL"):
        raise RuntimeError("Supabase credentials must not be set in isolated CI")
    manifest=json.loads((args.dir/"manifest.json").read_text(encoding="utf-8"))
    if manifest.get("feed_source")!="de-national":
        raise RuntimeError("Unexpected GTFS feed source")
    with psycopg.connect(args.db_url,autocommit=True,connect_timeout=10) as conn:
        with conn.cursor() as cur:
            cur.execute("select current_database(),current_user")
            if cur.fetchone()!=(EXPECTED_DB,EXPECTED_USER):
                raise RuntimeError("Must use isolated GitHub PostgreSQL")
            cur.execute("select to_regclass('legacy_bench.stop_times'),to_regclass('compact_bench.stop_times')")
            if not all(cur.fetchone()):
                raise RuntimeError("Previous benchmark schemas are missing")
            # Actual presence and counts protect against an empty/misrouted test DB.
            cur.execute("select (select count(*) from legacy_bench.stop_times),"
                        "(select count(*) from compact_bench.stop_times)")
            old_count,new_count=cur.fetchone()
            if old_count!=new_count or old_count!=int(manifest["counts"]["stop_times"]):
                raise RuntimeError("Previous benchmark's GTFS fact tables missing/mismatched")
            cur.execute("select to_regclass('legacy_bench.routes'),to_regclass('compact_bench.routes')")
            if cur.fetchone()!=(None,None):
                raise RuntimeError("Parity schemas already populated, use fresh disposable DB")
            print("Full GTFS metadata and API parity on LOCAL PostgreSQL",flush=True)
            create_full_schema(cur,args.dir,manifest["counts"])
            tested_days,active_by_day=check_service_calendar(cur,date.fromisoformat(
                manifest["selection"]["service_date"]))
            nearby=check_nearby(cur)
            departures=check_departures(cur,manifest)
            checked_trips=check_trip_routes(cur)
            sizes=get_sizes(cur)
            report={"ok":True,
                "scope":"disposable PostgreSQL benchmark; no Supabase access",
                "services_tested":tested_days,
                "daily_active_services":active_by_day,
                "nearby_tests":nearby,
                "departure_rpc":departures,
                "trip_route_checks":checked_trips,
                "full_schema_sizes":sizes,
                "shapes_note":"National source has no exact shapes; stop-based approximate geometry tested",
                "deployment_decision":"NOT APPROVED — requires separate peak disk, backup and production cutover validation"}
            args.report.write_text(json.dumps(report,indent=2)+"\n",encoding="utf8")
            print("FULL_API_PARITY_PASS",json.dumps(report,indent=2),flush=True)
    return 0

if __name__=="__main__":
    raise SystemExit(main())
