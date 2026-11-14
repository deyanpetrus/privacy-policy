#!/usr/bin/env python3
"""Temporary GTFS audit on a GitHub runner. Never imports, publishes or persists feed ZIPs."""
from __future__ import annotations
import argparse,csv,io,json,os,sys,zipfile
from collections import Counter
from datetime import datetime,timedelta,timezone
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.request import Request,urlopen
from zoneinfo import ZoneInfo

CATALOG=Path(__file__).with_name("catalog.json")
OUT=Path(os.environ.get("RUNNER_TEMP","/tmp"))/"lifedashpro-audits"
ZIP_LIMIT=25*1048576
EXPANDED_LIMIT=220*1048576
CANDIDATES={"mdb-768","mdb-3043","mdb-3517","mdb-3604","tld-1071","mdb-3427","mdb-2377"}
TZ={"mdb-768":"Europe/Berlin","mdb-3043":"Europe/Zagreb","mdb-3517":"Europe/Podgorica",
    "mdb-3604":"Europe/Sofia","tld-1071":"Europe/Zagreb",
    "mdb-3427":"Europe/Sarajevo","mdb-2377":"Europe/Podgorica"}
MANDATORY={"stops.txt","routes.txt","trips.txt","stop_times.txt"}
def extract_ymd(value):
    try:return datetime.strptime(value,"%Y%m%d").date()
    except (ValueError,TypeError):return None
def iter_rows(z,name):
    if name not in z.namelist():return
    with z.open(name) as src:
        reader=csv.DictReader(io.TextIOWrapper(src,encoding="utf-8-sig",newline=""))
        yield from reader

def fetch(url,dest):
    req=Request(url,headers={"User-Agent":"LifeDashPro-ReadOnly-GTFS-Validator/1.0","Accept":"application/zip"})
    with urlopen(req,timeout=40) as resp,open(dest,"wb") as out:
        if int(resp.headers.get("Content-Length") or 0)>ZIP_LIMIT:
            raise RuntimeError("ZIP_TOO_LARGE")
        received=0
        while True:
            buf=resp.read(1024*1024)
            if not buf:break
            received+=len(buf)
            if received>ZIP_LIMIT:raise RuntimeError("ZIP_TOO_LARGE")
            out.write(buf)
    if received<200:raise RuntimeError("ZIP_EMPTY")
    return received

def audit(feed,src,tmp):
    where=Path(tmp)/(feed+".zip")
    zipped=fetch(src["probe_url"],where)
    with zipfile.ZipFile(where) as z:
        if len(z.infolist())>300 or sum(f.file_size for f in z.infolist())>EXPANDED_LIMIT:
            raise RuntimeError("GTFS_EXPANDED_SIZE_OVER_CAP")
        names=set(z.namelist())
        if not MANDATORY.issubset(names):raise RuntimeError("MISSING_REQUIRED_GTFS_FILES")
        if any(".." in f.filename.split("/") for f in z.infolist()):
            raise RuntimeError("UNSAFE_ARCHIVE_MEMBER")
        stops=0;real_geolocations=0
        for row in iter_rows(z,"stops.txt"):
            stops+=1
            try:
                x,y=float(row.get("stop_lat","")),float(row.get("stop_lon",""))
                if -90<=x<=90 and -180<=y<=180:real_geolocations+=1
            except (ValueError,TypeError):pass
        route_types=Counter()
        for row in iter_rows(z,"routes.txt"):
            route_types[str(row.get("route_type","?"))]+=1
        trip_count=sum(1 for _ in iter_rows(z,"trips.txt"))
        event_count=sum(1 for _ in iter_rows(z,"stop_times.txt"))
        today=datetime.now(ZoneInfo(TZ[feed])).date()
        window=[today+timedelta(days=d) for d in range(3)]
        active={day:set() for day in window}
        for row in iter_rows(z,"calendar.txt"):
            start,end=extract_ymd(row.get("start_date")),extract_ymd(row.get("end_date"))
            if not start or not end:continue
            for day in window:
                if start<=day<=end and row.get(("monday","tuesday","wednesday","thursday",
                                                  "friday","saturday","sunday")[day.weekday()])=="1":
                    active[day].add(row.get("service_id",""))
        for row in iter_rows(z,"calendar_dates.txt"):
            day=extract_ymd(row.get("date"))
            if day not in active:continue
            if row.get("exception_type")=="1":active[day].add(row.get("service_id",""))
            elif row.get("exception_type")=="2":active[day].discard(row.get("service_id",""))
        calendar_ready=any(active.values())
        if stops<1 or len(route_types)<1 or trip_count<1 or event_count<1:
            raise RuntimeError("EMPTY_GTFS_CONTENT")
    return {"id":feed,"source_name":src["name"],"status":"calendar_present" if calendar_ready else "no_current_calendar",
        "zip_mib":round(zipped/1048576,3),"stops":stops,"geolocated_stops":real_geolocations,
        "routes":sum(route_types.values()),"route_types":dict(route_types),
        "trips":trip_count,"stop_times":event_count,"service_dates":{str(d):len(active[d]) for d in window},
        "license_gate":src["license"],"integration_policy":src["policy"],
        "quality":"source parsed; NOT promoted and NOT a rider-facing timetable"}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--feed",action="append",required=True,help="Curated small source ID; repeat flag")
    args=parser.parse_args()
    if len(args.feed)>3 or len(args.feed)!=len(set(args.feed)):
        raise RuntimeError("ONLY_1_TO_3_DISTINCT_FEEDS")
    sources={x["id"]:x for x in json.loads(CATALOG.read_text())["sources"]}
    if any(f not in CANDIDATES or sources[f]["kind"]!="gtfs" for f in args.feed):
        raise RuntimeError("FEED_NOT_APPROVED_FOR_TEMPORARY_AUDIT")
    OUT.mkdir(parents=True,exist_ok=True)
    result=[]
    with TemporaryDirectory(prefix="lifedashpro-audit-") as temp:
        for feed in args.feed:
            try:
                row=audit(feed,sources[feed],temp)
            except Exception as err:
                row={"id":feed,"status":"audit_failed","reason":str(err) if isinstance(err,RuntimeError) else type(err).__name__}
            result.append(row)
            print("GTFS_TEMP_AUDIT "+json.dumps(row,ensure_ascii=False,sort_keys=True))
    (OUT/"audit.json").write_text(json.dumps({"as_of":datetime.now(timezone.utc).isoformat(),"results":result},indent=2,ensure_ascii=False)+"\n")
    lines=["# European Transit GTFS — Temporary read-only audit","",
           "**No ZIP files uploaded. No Supabase or Android modification.**",""]
    for r in result:
        lines.extend([f"## {r['id']}: {r['status']}","",
                      "~~~json",json.dumps(r,indent=2,ensure_ascii=False),"~~~",""])
    content="\n".join(lines)+"\n"
    (OUT/"audit.md").write_text(content)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"],"a") as out:out.write(content)
    if all(r["status"]=="audit_failed" for r in result):
        raise RuntimeError("ALL_CANDIDATE_AUDITS_FAILED")
if __name__=="__main__":
    try:main()
    except Exception as exc:
        print("GTFS_AUDIT_ABORT_"+type(exc).__name__+" "+(str(exc) if isinstance(exc,RuntimeError) else ""),file=sys.stderr)
        raise SystemExit(1)
