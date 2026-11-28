#!/usr/bin/env python3
"""NEXT ONLY. Official GTFS.de local/rural buses in selected Bavarian regions.

Source: https://download.gtfs.de/germany/nv_free/latest.zip (CC BY 4.0 / DELFI).
Never imports an entire nationwide feed; safe A/B slot swap in isolated
transit_next.bus_* only. No changes to transit_data, navigation or production.
"""
from __future__ import annotations
import argparse,csv,io,json,math,os,sys,urllib.request,zipfile
from collections import defaultdict
from datetime import datetime,timedelta
from pathlib import Path
from tempfile import TemporaryDirectory
from zoneinfo import ZoneInfo
import psycopg
from psycopg.types.json import Jsonb
from dedicated_gtfs_import import verify_target

PROJECT="gnqtngtuzbxohgwgvmpb"
SECRET="LDP_DEDICATED_TRANSIT_DB_URL"
URL="https://download.gtfs.de/germany/nv_free/latest.zip"
TIMEZONE="Europe/Berlin"
CENTERS={
    "Neustadt an der Donau":(48.806,11.766),
    "Bad Goegging":(48.821,11.783),
    "Abensberg":(48.819,11.846),
    "Kelheim":(48.918,11.875),
    "Riedenburg":(48.963,11.685),
    "Altmannstein":(48.898,11.650),
}
# Only a local spatial subset; no nationwide stop/trip rows in Supabase.
RADIUS_KM=13
# Additional city coverage, independent of the original rural bounding box.
CITY_CENTERS={"Regensburg":(49.0134,12.1016,6),"Scharmassing":(48.95,12.15,5)}
ZIP_CAP=330*1048576
EXPANDED_CAP=7_500*1048576
MAX_INITIAL_STOPS=6500
MAX_SERVED_STOPS=3000
MAX_ACTIVE_TRIPS=1_500_000
MAX_EVENTS=140_000
MAX_PAYLOAD_BYTES=12*1048576
PRE_DB_CAP=325*1048576
POST_DB_CAP=370*1048576
MIN_STOPS=15
MIN_EVENTS=40

def fail(msg):raise RuntimeError(msg)
def distance(a,b,c,d):
    rad=math.pi/180
    h=math.sin((c-a)*rad/2)**2+math.cos(a*rad)*math.cos(c*rad)*math.sin((d-b)*rad/2)**2
    return 12742.016*math.asin(math.sqrt(min(1,h)))
def is_near(lat,lon):
    if 48.65<=lat<=49.12 and 11.48<=lon<=12.05:
        if any(distance(lat,lon,c,d)<=RADIUS_KM for c,d in CENTERS.values()):return True
    if not (48.86<=lat<=49.08 and 12.00<=lon<=12.24):return False
    return any(distance(lat,lon,c,d)<=radius for c,d,radius in CITY_CENTERS.values())
def rows(z,name):
    with z.open(name) as raw:
        yield from csv.DictReader(io.TextIOWrapper(raw,encoding="utf-8-sig",newline=""))
def parse_date(x):
    try:return datetime.strptime(x,"%Y%m%d").date()
    except (ValueError,TypeError):return None
def parse_secs(x):
    try:
        h,m,s=map(int,x.split(":"))
        return h*3600+m*60+s if 0<=h<=47 and 0<=m<60 and 0<=s<60 else None
    except (TypeError,ValueError,AttributeError):return None
def download(target):
    req=urllib.request.Request(URL,headers={"User-Agent":"LifeDashPro-NEXT-Kelheim-Bus/1.0","Accept":"application/zip"})
    with urllib.request.urlopen(req,timeout=120) as src,open(target,"wb") as out:
        if int(src.headers.get("Content-Length") or 0)>ZIP_CAP:fail("ZIP_CONTENT_LENGTH_TOO_BIG")
        n=0
        while True:
            chunk=src.read(1048576)
            if not chunk:break
            n+=len(chunk)
            if n>ZIP_CAP:fail("ZIP_TOO_BIG")
            out.write(chunk)
        if n<1_000_000:fail("ZIP_TOO_SMALL")
    return n
def service_calendar(z,dates):
    daily={d:set() for d in dates}
    if "calendar.txt" in z.namelist():
        for row in rows(z,"calendar.txt"):
            sd,ed=parse_date(row.get("start_date")),parse_date(row.get("end_date"))
            if sd is None or ed is None:continue
            sid=row.get("service_id","")
            for day in dates:
                key=("monday","tuesday","wednesday","thursday","friday","saturday","sunday")[day.weekday()]
                if sd<=day<=ed and row.get(key)=="1":daily[day].add(sid)
    if "calendar_dates.txt" in z.namelist():
        for row in rows(z,"calendar_dates.txt"):
            day=parse_date(row.get("date"))
            if day not in daily:continue
            sid=row.get("service_id","")
            if row.get("exception_type")=="1":daily[day].add(sid)
            elif row.get("exception_type")=="2":daily[day].discard(sid)
    if not any(daily.values()):fail("NO_ACTIVE_CALENDAR_SERVICES")
    return daily
def build(archive):
    now=datetime.now(ZoneInfo(TIMEZONE))
    dates=[now.date(),now.date()+timedelta(days=1)]
    with zipfile.ZipFile(archive) as z:
        names=set(z.namelist())
        needed={"stops.txt","routes.txt","trips.txt","stop_times.txt"}
        if not needed<=names:fail("GTFS_MISSING_REQUIRED")
        if sum(i.file_size for i in z.infolist())>EXPANDED_CAP:fail("ZIP_EXPANSION_LIMIT")
        stops={}
        for row in rows(z,"stops.txt"):
            try:lat,lon=float(row["stop_lat"]),float(row["stop_lon"])
            except (KeyError,ValueError,TypeError):continue
            if not math.isfinite(lat) or not math.isfinite(lon) or not is_near(lat,lon):continue
            sid=(row.get("stop_id") or "").strip()
            if sid:
                stops[sid]={"name":(row.get("stop_name") or sid)[:220],
                    "lat":lat,"lon":lon,"platform":(row.get("platform_code") or "")[:60] or None}
            if len(stops)>MAX_INITIAL_STOPS:fail("TOO_MANY_SPATIALLY_SELECTED_STOPS")
        if not stops:fail("NO_STOPS_IN_KELHEIM_OR_REGENSBURG_AREA")
        city_seeds=sum(distance(49.0134,12.1016,s['lat'],s['lon'])<=6 for s in stops.values())
        if city_seeds<40:fail("NO_CONFIRMED_REGENSBURG_STOP_SEEDS")
        print("SELECTED_LOCAL_STOP_SEEDS",len(stops),flush=True)
        routes={}
        for row in rows(z,"routes.txt"):
            rt=(row.get("route_type") or "").strip()
            if rt!="3" and not(rt.isdigit() and 700<=int(rt)<800):continue
            rid=row.get("route_id","")
            if rid:
                routes[rid]=(row.get("route_short_name") or row.get("route_long_name") or rid)[:85]
        if not routes:fail("NO_BUS_ROUTES_IN_FEED")
        calendar=service_calendar(z,dates)
        trips={}
        for row in rows(z,"trips.txt"):
            rid=row.get("route_id","")
            if rid not in routes:continue
            service=row.get("service_id","")
            active=tuple(day for day in dates if service in calendar[day])
            if not active:continue
            tid=row.get("trip_id","")
            if tid:
                trips[tid]=(rid,active,(row.get("trip_headsign") or row.get("trip_short_name") or "")[:110])
            if len(trips)>MAX_ACTIVE_TRIPS:fail("TOO_MANY_ACTIVE_BUS_TRIPS")
        if not trips:fail("NO_ACTIVE_BUS_TRIPS")
        print("ACTIVE_BUS_TRIPS_IN_SOURCE",len(trips),flush=True)
        entries=defaultdict(list)
        seen=set()
        lines=defaultdict(set)
        count=0
        processed=0
        for row in rows(z,"stop_times.txt"):
            processed+=1
            sid=row.get("stop_id","")
            if sid not in stops:continue
            trip=trips.get(row.get("trip_id",""))
            if not trip:continue
            secs=parse_secs(row.get("departure_time") or row.get("arrival_time"))
            if secs is None:continue
            route_id,valid_days,headsign=trip
            line=routes[route_id]
            for day in valid_days:
                occurrence=datetime(day.year,day.month,day.day,tzinfo=now.tzinfo)+timedelta(seconds=secs)
                if not (now-timedelta(minutes=10)<=occurrence<=now+timedelta(hours=27)):continue
                key=(sid,day,row.get("trip_id",""),secs)
                if key in seen:continue
                seen.add(key)
                entries[(sid,day)].append({
                    "tripId":(row.get("trip_id","") or "")[:130],
                    "line":line,
                    "direction":(row.get("stop_headsign") or headsign)[:110],
                    "mode":"bus","time":f"{secs//3600:02d}:{secs//60%60:02d}",
                    "departureSecs":secs
                })
                lines[sid].add(line)
                count+=1
                if count>MAX_EVENTS:fail("LOCAL_EVENTS_OVER_CAP")
            if processed%10_000_000==0:print("SCAN_STOPTIMES",processed,flush=True)
        served={sid for sid,day in entries}
        if len(served)<MIN_STOPS or count<MIN_EVENTS:fail("NOT_ENOUGH_CURRENT_LOCAL_BUS_SERVICE")
        if len(served)>MAX_SERVED_STOPS:fail("SERVED_STOPS_OVER_CAP")
        result_stops=[]
        for sid in sorted(served):
            s=stops[sid]
            result_stops.append((sid,s["name"],s["lat"],s["lon"],s["platform"],"bus",sorted(lines[sid])[:75]))
        result_dep=[]
        bytes_used=0
        for (sid,day),events in sorted(entries.items()):
            data=sorted(events,key=lambda x:(x["departureSecs"],x["line"],x["tripId"]))
            payload=json.dumps(data,ensure_ascii=False,separators=(",",":"))
            bytes_used+=len(payload.encode("utf-8"))
            if bytes_used>MAX_PAYLOAD_BYTES:fail("LOCAL_PAYLOAD_BYTES_OVER_CAP")
            result_dep.append((sid,day,Jsonb(data)))
        coverage={}
        for city,(lat,lon) in CENTERS.items():
            coverage[city]=sum(distance(lat,lon,s[2],s[3])<=6 for s in result_stops)
        if coverage["Neustadt an der Donau"]<3:fail("NO_CONFIRMED_NEUSTADT_LOCAL_BUS_SERVICE")
        for city,(lat,lon,radius) in CITY_CENTERS.items():
            coverage[city]=sum(distance(lat,lon,s[2],s[3])<=radius for s in result_stops)
        if coverage["Regensburg"]<40:fail("NO_CONFIRMED_REGENSBURG_LOCAL_BUS_SERVICE")
        stats={"feed":"official_gtfs_de_nv_free","stops":len(result_stops),
               "stop_day_rows":len(result_dep),"events":count,"date_start":str(dates[0]),
               "payload_mib":round(bytes_used/1048576,2),
               "area_coverage_6km":coverage,"times_source":"scheduled_not_realtime"}
        print("BUS_H3_SOURCE_VERIFIED "+json.dumps(stats,ensure_ascii=False),flush=True)
        return result_stops,result_dep,stats
def import_data(stops,departures,stats):
    dsn=os.environ.get(SECRET,"")
    if not dsn:fail("DEDICATED_DB_URL_SECRET_MISSING")
    verify_target(dsn)
    with psycopg.connect(dsn,connect_timeout=25,sslmode="require") as conn:
        with conn.transaction():
            with conn.cursor() as cur:
                cur.execute("select current_database(),current_user")
                if cur.fetchone()!=("postgres","postgres"):fail("WRONG_DB_OR_ROLE")
                cur.execute("select pg_try_advisory_xact_lock(820617,20261017)")
                if cur.fetchone()[0] is not True:fail("ANOTHER_TRANSIT_IMPORT_RUNNING")
                cur.execute("select pg_database_size(current_database())")
                before=cur.fetchone()[0]
                if before>=PRE_DB_CAP:fail("DEDICATED_DB_OVER_SAFE_CAP")
                cur.execute("select active_slot,loaded_at,expires_at from transit_next.bus_meta where id=1 for update")
                meta=cur.fetchone()
                if not meta or meta[0] not in ("a","b"):fail("BUS_META_INVALID")
                old_slot,loaded,expires=meta
                if (loaded and expires and loaded>datetime.now(loaded.tzinfo)-timedelta(hours=12)
                    and expires>datetime.now(expires.tzinfo)+timedelta(hours=12)):
                    # A recently loaded old-coverage snapshot must not suppress the first city refresh.
                    cur.execute("select count(*) from transit_next.bus_stops_"+old_slot+" where lat between 48.98 and 49.04 and lon between 12.06 and 12.17")
                    if cur.fetchone()[0]>=40:
                        print("BUS_H3_FRESH_SKIP",flush=True)
                        return
                inactive="b" if old_slot=="a" else "a"
                s_table="transit_next.bus_stops_"+inactive
                d_table="transit_next.bus_departures_"+inactive
                cur.execute("truncate table "+d_table+", "+s_table)
                cur.executemany("insert into "+s_table+" (stop_id,name,lat,lon,platform,mode,lines) values (%s,%s,%s,%s,%s,%s,%s)",stops)
                cur.executemany("insert into "+d_table+" (stop_id,service_date,payload) values (%s,%s,%s)",departures)
                cur.execute("select count(*) from "+s_table)
                if cur.fetchone()[0]!=len(stops):fail("BUS_STOPS_POST_WRITE_MISMATCH")
                cur.execute("select count(*) from "+d_table)
                if cur.fetchone()[0]!=len(departures):fail("BUS_DEPARTURES_POST_WRITE_MISMATCH")
                cur.execute("select pg_database_size(current_database())")
                after=cur.fetchone()[0]
                if after>=POST_DB_CAP:fail("DEDICATED_DB_POST_IMPORT_CAP_ROLLBACK")
                cur.execute("""update transit_next.bus_meta
                    set active_slot=%s,loaded_at=now(),expires_at=now()+interval '35 hours',
                        stops=%s,departures=%s where id=1""",(inactive,len(stops),stats["events"]))
                if cur.rowcount!=1:fail("BUS_META_POINTER_FLIP_FAILED")
                cur.execute("""update transit_next.feed_registry set integration_state='enabled',
                    last_checked_at=now(),note='Scheduled GTFS.de bus subset; original rural areas plus Regensburg and Scharmassing; no realtime'
                    where feed_id='de-rural-bus'""")
                print("BUS_H3_READY_TO_COMMIT "+json.dumps({"slot":inactive,
                    "rows":len(stops),"departures":stats["events"],
                    "db_before_mib":round(before/1048576,2),
                    "db_after_mib":round(after/1048576,2)}),flush=True)
        print("BUS_H3_COMMITTED",flush=True)
def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--mode",choices=("plan","refresh"),default="plan")
    ap.add_argument("--confirm-project-ref",default="")
    args=ap.parse_args()
    if args.mode=="refresh" and args.confirm_project_ref!=PROJECT:fail("TARGET_CONFIRMATION_MISMATCH")
    with TemporaryDirectory(prefix="lifedash-next-bus-") as d:
        p=Path(d)/"nv_free_latest.zip"
        n=download(p)
        print("OFFICIAL_GTFS_ARCHIVE_MIB",round(n/1048576,2),flush=True)
        stop_rows,dep_rows,stats=build(p)
        if args.mode=="refresh":import_data(stop_rows,dep_rows,stats)
        else:print("BUS_H3_PLAN_ONLY_NO_DB_WRITES",flush=True)
if __name__=="__main__":
    try:main()
    except Exception as e:
        print("SAFE_BUS_H3_IMPORT_STOP "+(str(e) if isinstance(e,RuntimeError) else type(e).__name__),file=sys.stderr)
        raise SystemExit(1)
