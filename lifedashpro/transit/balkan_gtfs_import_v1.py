#!/usr/bin/env python3
"""LifeDashPro additive BG/BA/MK GTFS import. Never touches existing feed tables.
Writes only transit_next.balkan_*_v1 in dedicated Transit Supabase.
No commercial API dependency; UTC/GPS searches remain on existing application endpoints.
"""
from __future__ import annotations
import argparse, csv, datetime as dt, hashlib, io, json, os, re, sys, urllib.request, zipfile
from collections import defaultdict
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo
import psycopg
from psycopg.types.json import Jsonb

PROJECT="gnqtngtuzbxohgwgvmpb"
DB_SECRET="LDP_DEDICATED_TRANSIT_DB_URL"
CAP_BYTES=24*1024*1024
MAX_DB_MIB=420
HEADERS={"User-Agent":"LifeDashPro Balkan Import (https://mkdigital.app/)"}
FEEDS=[
 ("bg:bdz","BG","BDZ Bulgaria","https://gtfs.livetransport.eu/gtfs/bdz.zip","Europe/Sofia","CC-BY-4.0","livetransport.eu / БДЖ – Пътнически превози","train",True),
 ("bg:varna","BG","Varna Public Transport","https://gtfs.livetransport.eu/gtfs/varna.zip","Europe/Sofia","CC-BY-4.0","livetransport.eu / ОП ТАСРУД Варна","bus",True),
 ("bg:plovdiv","BG","Plovdiv Public Transport","https://gtfs.livetransport.eu/gtfs/plovdiv.zip","Europe/Sofia","CC-BY-4.0","livetransport.eu / Plovdiv operator","bus",True),
 ("bg:stara-zagora","BG","Stara Zagora Transit","https://gtfs.livetransport.eu/gtfs/stara-zagora.zip","Europe/Sofia","CC-BY-4.0","livetransport.eu / Stara Zagora operators","bus",True),
 ("bg:dobrich","BG","Dobrich Transit","https://gtfs.livetransport.eu/gtfs/dobrich.zip","Europe/Sofia","CC-BY-4.0","livetransport.eu / Dobrich operators","bus",True),
 ("bg:yambol","BG","Yambol Transit","https://gtfs.livetransport.eu/gtfs/yambol.zip","Europe/Sofia","CC-BY-4.0","livetransport.eu / Община Ямбол","bus",True),
 ("bg:kazanlak","BG","Kazanlak Transit","https://gtfs.livetransport.eu/gtfs/kazanlak.zip","Europe/Sofia","CC-BY-4.0","livetransport.eu / Община Казанлък","bus",True),
 ("bg:sliven","BG","Sliven Transit","https://gtfs.livetransport.eu/gtfs/sliven.zip","Europe/Sofia","CC-BY-4.0","livetransport.eu / Пътнически превози ЕООД - Сливен","bus",True),
 ("ba:sarajevo","BA","Sarajevo Transport","https://gitlab.com/api/v4/projects/vekejsn%2Fgtfs-generators/packages/generic/sarajevo-gtfs/latest/sarajevo_gtfs.zip","Europe/Sarajevo","permission-verified-by-owner","Ministarstvo saobraćaja Kantona Sarajevo / vekejsn GTFS generator","bus",True),
 ("ba:mostar","BA","Mostar Bus","https://gitlab.com/api/v4/projects/vekejsn%2Fgtfs-generators/packages/generic/mostar-gtfs/latest/mobus_gtfs.zip","Europe/Sarajevo","permission-verified-by-owner","Mostar Bus / vekejsn GTFS generator","bus",True),
 ("ba:livnobus","BA","Li-Bus Livno","https://livnobus.com/gtfs/google-transit","Europe/Sarajevo","permission-verified-by-owner","Turistička agencija Li-Bus d.o.o.","bus",True),
 # MK staged deliberately as shadow, no duplicates of existing working JSP and MŽ.
 ("mk:rail","MK","MŽ Macedonia Rail","https://github.com/deryclem/gtfs-north-macedonia/raw/main/gtfs-north-macedonia.zip","Europe/Skopje","permission-verified-by-owner","MŽ North Macedonia / deryclem community GTFS","train",False),
 # Skopje JSP is already live in its existing protected cache; do not duplicate it here.
]
def get(url):
    if urlsplit(url).scheme!="https":raise ValueError("Only HTTPS feeds allowed")
    r=urllib.request.Request(url,headers=HEADERS)
    with urllib.request.urlopen(r,timeout=45) as resp:
        if urlsplit(resp.geturl()).scheme!="https":raise ValueError("Insecure redirect")
        ln=resp.headers.get("Content-Length")
        if ln and int(ln)>CAP_BYTES:raise ValueError("ZIP too large")
        data=resp.read(CAP_BYTES+1)
    if len(data)>CAP_BYTES:raise ValueError("ZIP over 24 MiB")
    return data

def read_zip(raw):
    z=zipfile.ZipFile(io.BytesIO(raw))
    fl=z.infolist()
    if len(fl)>140 or sum(f.file_size for f in fl)>220*1024*1024:raise ValueError("Unsafe expanded ZIP size")
    for f in fl:
        if ".." in f.filename.split("/") or "\\" in f.filename or f.filename.startswith("/"):raise ValueError("Bad path")
    index={f.filename.split("/")[-1].lower():f.filename for f in fl if not f.is_dir()}
    required={"stops.txt","routes.txt","trips.txt","stop_times.txt"}
    if not required.issubset(index):raise ValueError("Missing required GTFS CSV")
    def rows(name):
        if name not in index:return []
        with z.open(index[name]) as stream:
            return list(csv.DictReader(io.TextIOWrapper(stream,encoding="utf-8-sig",errors="replace",newline="")))
    return rows

def int_seconds(value):
    m=re.fullmatch(r"(\d{1,2}):(\d{2}):(\d{2})",str(value or "").strip())
    if not m:return None
    a,b,c=map(int,m.groups())
    if a>47 or b>59 or c>59:return None
    return a*3600+b*60+c

def mode_of(value,hint):
    try:code=int(value)
    except:return hint
    return {0:"tram",1:"metro",2:"train",3:"bus",4:"ferry",5:"tram",6:"bus",7:"bus",11:"bus",12:"bus"}.get(code,hint)
def service_dates(rows,dates,start):
    cal=rows("calendar.txt"); changes=rows("calendar_dates.txt")
    out={day.isoformat():set() for day in dates}
    for row in cal:
        sid=row.get("service_id","")
        a=row.get("start_date","");b=row.get("end_date","")
        if not sid or not re.fullmatch(r"\d{8}",a) or not re.fullmatch(r"\d{8}",b):continue
        for date in dates:
            if a<=date.strftime("%Y%m%d")<=b and row.get(date.strftime("%A").lower(),"0")=="1":
                out[date.isoformat()].add(sid)
    for row in changes:
        ds=row.get("date","")
        if not re.fullmatch(r"\d{8}",ds):continue
        date=f"{ds[:4]}-{ds[4:6]}-{ds[6:]}"
        if date not in out:continue
        sid=row.get("service_id","")
        if row.get("exception_type")=="1":out[date].add(sid)
        elif row.get("exception_type")=="2":out[date].discard(sid)
    if not cal and not changes:raise ValueError("No service calendar")
    return out

def plan_feed(feed):
    feed_id,cc,name,url,tz,licence,attribution,hint,publish=feed
    raw=get(url); rows=read_zip(raw)
    today=dt.datetime.now(ZoneInfo(tz)).date()
    days=[today+dt.timedelta(days=i) for i in range(3)]
    services=service_dates(rows,days,today)
    stops={}
    for s in rows("stops.txt"):
        sid=s.get("stop_id","")
        try:lat=float(s.get("stop_lat",""));lon=float(s.get("stop_lon",""))
        except:continue
        if not sid or not (-90<=lat<=90) or not(-180<=lon<=180):continue
        if sid in stops:continue
        stops[sid]={"id":sid,"name":str(s.get("stop_name") or sid)[:180],"lat":lat,"lon":lon,
                    "platform":str(s.get("platform_code",""))[:40] or None,"modes":set(),"lines":set()}
    routes={}
    for r in rows("routes.txt"):
        rid=r.get("route_id","")
        label=str(r.get("route_short_name") or r.get("route_long_name") or rid or "").strip()[:80]
        if rid and label:routes[rid]=(label,mode_of(r.get("route_type"),hint))
    trips={}
    service_keys=set().union(*services.values())
    for t in rows("trips.txt"):
        tid=t.get("trip_id","");rid=t.get("route_id","");sid=t.get("service_id","")
        if tid and rid in routes and sid in service_keys:
            trips[tid]=(rid,sid,str(t.get("trip_headsign") or "")[:140])
    accum=defaultdict(list);total=0
    for item in rows("stop_times.txt"):
        tid=item.get("trip_id","");trip=trips.get(tid)
        if not trip:continue
        stop=item.get("stop_id","")
        if stop not in stops:continue
        sec=int_seconds(item.get("departure_time") or item.get("arrival_time"))
        if sec is None:continue
        rid,sid,head=trip;line,mode=routes[rid]
        stops[stop]["modes"].add(mode);stops[stop]["lines"].add(line)
        for date,enabled in services.items():
            if sid not in enabled:continue
            accum[(stop,date)].append({"departureSecs":sec,"tripId":tid[:90],
               "line":line,"direction":head,"mode":mode})
            total+=1
            if total>750000:raise ValueError("Too many stop-time events for Free tier")
    if not stops or not routes or not trips or total<10:raise ValueError("GTFS lacks active service in next 4 days")
    canonical=[]
    for s in stops.values():
        if not s["lines"]:continue
        ordered=sorted(s["modes"],key=lambda x:["train","metro","tram","bus","ferry","other"].index(x) if x in ["train","metro","tram","bus","ferry","other"] else 5)
        canonical.append((feed_id,s["id"],s["name"],s["lat"],s["lon"],ordered[0] if ordered else hint,
                          sorted(s["lines"])[:80],s["platform"]))
    result=[]
    for (stop,date),seq in accum.items():
        seq.sort(key=lambda x:(x["departureSecs"],x["line"],x["tripId"]))
        # retain all planned departures in 4-day rolling window, max 1600 per stop/day
        result.append((feed_id,stop,date,Jsonb(seq[:1600])))
    if len(canonical)>12000 or len(result)>45000:raise ValueError("Dataset exceeds small-city safety caps")
    maxdate=max((row.get("end_date","") for row in rows("calendar.txt") if re.fullmatch(r"\d{8}",row.get("end_date",""))),default="")
    if not maxdate:
        maxdate=max((row.get("date","") for row in rows("calendar_dates.txt") if re.fullmatch(r"\d{8}",row.get("date",""))),default="")
    valid_until=dt.datetime.strptime(maxdate,"%Y%m%d").date() if maxdate else days[-1]
    # Prevent a 2099 calendar from making an abandoned cache appear current forever.
    valid_until=min(valid_until,days[0]+dt.timedelta(days=8))
    if valid_until<days[0]:raise ValueError("GTFS expired")
    return {"feed":feed,"sha":hashlib.sha256(raw).hexdigest(),"stops":canonical,"departures":result,
            "events":total,"valid_until":valid_until,"valid_from":days[0],"publish":publish}

def verify_db(url):
    parts=urlsplit(url)
    host=parts.hostname or ""
    user=parts.username or ""
    is_direct=host==f"db.{PROJECT}.supabase.co" and user=="postgres"
    is_pooler=host.endswith(".pooler.supabase.com") and user==f"postgres.{PROJECT}"
    if parts.scheme not in ("postgres","postgresql") or not (is_direct or is_pooler):
        raise RuntimeError("SAFE_STOP_WRONG_DB_TARGET")
    if not url or not parts.password:raise RuntimeError("SAFE_STOP_DB_CREDENTIAL_MISSING")
def save(plan,conn):
    fid,cc,name,url,tz,licence,credit,hint,publish=plan["feed"]
    with conn.transaction():
        with conn.cursor() as cur:
            cur.execute("select pg_try_advisory_xact_lock(20261119,4701)")
            if not cur.fetchone()[0]:raise RuntimeError("BALKAN_IMPORT_LOCK_BUSY")
            cur.execute("select pg_database_size(current_database())")
            if cur.fetchone()[0]>MAX_DB_MIB*1048576:raise RuntimeError("FREE_TIER_QUOTA_GUARD")
            cur.execute("""insert into transit_next.balkan_feed_meta_v1
             (feed_id,country_code,display_name,source_url,license_note,attribution,mode_hint,active,published)
             values (%s,%s,%s,%s,%s,%s,%s,false,false)
             on conflict(feed_id) do update set active=false,published=false""",
             (fid,cc,name,url,licence,credit,hint))
            # Transactional reset; any error rolls back to previously published content.
            cur.execute("delete from transit_next.balkan_stops_v1 where feed_id=%s",(fid,))
            cur.executemany("""insert into transit_next.balkan_stops_v1
              (feed_id,stop_id,name,lat,lon,mode,lines,platform)
              values(%s,%s,%s,%s,%s,%s,%s,%s)""",plan["stops"])
            cur.executemany("""insert into transit_next.balkan_departures_v1
              (feed_id,stop_id,service_date,payload) values(%s,%s,%s,%s)""",plan["departures"])
            cur.execute("""update transit_next.balkan_feed_meta_v1
              set active=true,published=%s,loaded_at=now(),valid_from=%s,valid_until=%s,
               stops=%s,departures=%s,source_hash=%s where feed_id=%s""",
              (bool(publish),plan["valid_from"],plan["valid_until"],len(plan["stops"]),plan["events"],plan["sha"],fid))
            cur.execute("select pg_database_size(current_database())")
            if cur.fetchone()[0]>MAX_DB_MIB*1048576:raise RuntimeError("POSTIMPORT_FREE_TIER_QUOTA_GUARD")

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--confirm-project-ref",required=True)
    ap.add_argument("--only",default="all")
    ap.add_argument("--dry-run",action="store_true")
    args=ap.parse_args()
    if args.confirm_project_ref!=PROJECT:raise RuntimeError("SAFE_STOP_UNEXPECTED_PROJECT")
    if os.environ.get("LDP_TRANSIT_DB_URL"):raise RuntimeError("SAFE_STOP_OLD_PRODUCTION_SECRET_PRESENT")
    selected=[f for f in FEEDS if args.only=="all" or f[0]==args.only]
    if not selected:raise RuntimeError("Unknown feed")
    url=os.getenv(DB_SECRET,"")
    if not args.dry_run:verify_db(url)
    failures=[];results=[]
    for feed in selected:
        try:
            plan=plan_feed(feed)
            if not args.dry_run:
                with psycopg.connect(url,sslmode="require",connect_timeout=20,autocommit=True) as conn:save(plan,conn)
            results.append({"feed_id":feed[0],"stops":len(plan["stops"]),"departures":plan["events"],
                            "published":plan["publish"] and not args.dry_run,
                            "valid_until":str(plan["valid_until"]),"state":"imported" if not args.dry_run else "dry_run"})
            print("BALKAN_FEED_OK",json.dumps(results[-1]),flush=True)
        except Exception as e:
            code=type(e).__name__
            failures.append({"feed_id":feed[0],"state":"failed","error_type":code})
            print("BALKAN_FEED_FAIL",feed[0],code,flush=True)
    os.makedirs("out",exist_ok=True)
    with open("out/balkan-import-report.json","w") as handle:
        json.dump({"project":PROJECT,"writes":not args.dry_run,"successes":results,"failures":failures},handle,indent=2)
    if not results:raise SystemExit("No usable Balkan feed was imported")
    if failures:print("BALKAN_PARTIAL_FAILURE",len(failures),flush=True)
if __name__=="__main__":
    try:main()
    except Exception as error:
        print("BALKAN_SAFE_STOP",type(error).__name__,file=sys.stderr)
        raise SystemExit(1)
