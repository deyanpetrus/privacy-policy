#!/usr/bin/env python3
"""LifeDashPro NEXT read-only national GTFS coverage audit for priority German cities.

No Supabase credentials, no writes, no API enumeration. Reads ONE GTFS.de national
public-transport ZIP per run on GitHub. Shows what the source actually covers
before selecting small licensed region packs. Does not create offline timetables.
"""
from __future__ import annotations
import argparse,csv,io,json,math,sys,urllib.request,zipfile
from collections import defaultdict
from datetime import datetime,timedelta
from pathlib import Path
from tempfile import TemporaryDirectory
from zoneinfo import ZoneInfo
from typing import Iterable

URL="https://download.gtfs.de/germany/nv_free/latest.zip"
ZIP_LIMIT=340*1048576
EXPANDED_LIMIT=8_000*1048576
# Rough centers are used for coverage testing only; not user geolocation.
CENTERS={
 "Regensburg":(49.0134,12.1016),
 "Obertraubling":(48.9655,12.1671),
 "Neustadt an der Donau":(48.806,11.766),
 "Pfaffenhofen an der Ilm":(48.5317,11.5050),
 "Pfaffenhofen an der Zaber":(49.0670,8.9670),
 "Bremen":(53.0793,8.8017),
 "Hamburg":(53.5511,9.9937),
 "Berlin":(52.5200,13.4050),
 "Stuttgart":(48.7758,9.1829),
 "Dresden":(51.0504,13.7373),
 "Munich":(48.1374,11.5755),
 "Nuremberg":(49.4521,11.0767),
 "Cologne":(50.9375,6.9603),
 "Frankfurt am Main":(50.1109,8.6821),
 "Leipzig":(51.3397,12.3731),
 "Siegenburg":(48.756,11.847),
}
def near_km(a,b,c,d):
 r=math.pi/180
 x=math.sin((a-c)*r/2)**2+math.cos(a*r)*math.cos(c*r)*math.sin((b-d)*r/2)**2
 return 12742.016*math.asin(math.sqrt(min(1,max(0,x))))
def read(z:zipfile.ZipFile,name:str)->Iterable[dict[str,str]]:
 with z.open(name) as f:
  yield from csv.DictReader(io.TextIOWrapper(f,encoding="utf-8-sig",newline=""))
def dateval(raw:str|None):
 try:return datetime.strptime(raw or "", "%Y%m%d").date()
 except ValueError:return None
def mode_for(raw:str|None):
 try:n=int(raw or "")
 except ValueError:return "other"
 if n==3 or 700<=n<800:return "bus"
 if n==109:return "suburban"
 if n==2 or 100<=n<200:return "train"
 if n==0 or 900<=n<1000:return "tram"
 if n==1 or 400<=n<500:return "metro"
 if n==4:return "ferry"
 return "other"
def active_services(z:zipfile.ZipFile,days):
 perday={d:set() for d in days}
 if "calendar.txt" in z.namelist():
  for r in read(z,"calendar.txt"):
   start,end=dateval(r.get("start_date")),dateval(r.get("end_date"))
   if start is None or end is None:continue
   service=r.get("service_id","")
   for d in days:
    if start<=d<=end and r.get(("monday","tuesday","wednesday","thursday","friday","saturday","sunday")[d.weekday()])=="1":
     perday[d].add(service)
 if "calendar_dates.txt" in z.namelist():
  for r in read(z,"calendar_dates.txt"):
   d=dateval(r.get("date"));service=r.get("service_id","")
   if d not in perday:continue
   if r.get("exception_type")=="1":perday[d].add(service)
   elif r.get("exception_type")=="2":perday[d].discard(service)
 return set().union(*perday.values()) if perday else set()
def download(dest:Path):
 request=urllib.request.Request(URL,headers={"User-Agent":"LifeDashPro-NEXT-CoverageAudit/1.0 (+https://mkdigital.app/)","Accept":"application/zip"})
 with urllib.request.urlopen(request,timeout=120) as response,dest.open("wb") as target:
  size=int(response.headers.get("Content-Length") or "0")
  if size>ZIP_LIMIT:raise RuntimeError("REFUSE_OVERSIZE_GTFS_ZIP")
  total=0
  while True:
   data=response.read(1024*1024)
   if not data:break
   total+=len(data)
   if total>ZIP_LIMIT:raise RuntimeError("REFUSE_DOWNLOAD_OVER_CAP")
   target.write(data)
  if total<1_000_000:raise RuntimeError("GTFS_ZIP_UNEXPECTEDLY_SMALL")
 return total
def evaluate(archive:Path,days:list):
 with zipfile.ZipFile(archive) as z:
  filenames=set(z.namelist())
  if not {"stops.txt","routes.txt","trips.txt","stop_times.txt"}.issubset(filenames):
   raise RuntimeError("GTFS_REQUIRED_FILES_MISSING")
  if sum(m.file_size for m in z.infolist())>EXPANDED_LIMIT:
   raise RuntimeError("GTFS_EXPANSION_LIMIT")
  service_ids=active_services(z,days)
  if not service_ids:raise RuntimeError("GTFS_NO_ACTIVE_SERVICES")
  print("ACTIVE_GTFS_SERVICE_IDS",len(service_ids),flush=True)
  spatial={} # sid -> list of (city, distance)
  seed_counts=defaultdict(lambda:{"6km":0,"12km":0})
  for r in read(z,"stops.txt"):
   sid=r.get("stop_id","")
   if not sid:continue
   try:lat=float(r["stop_lat"]);lon=float(r["stop_lon"])
   except (KeyError,ValueError,TypeError):continue
   if not math.isfinite(lat) or not math.isfinite(lon) or not(47<lat<56 and 5<lon<17):continue
   hit=[]
   for city,(clat,clon) in CENTERS.items():
    # Cheap bounding reject prior to haversine.
    if abs(lat-clat)>0.111 or abs(lon-clon)>0.17:continue
    d=near_km(lat,lon,clat,clon)
    if d<=12:
     hit.append((city,d))
     seed_counts[city]["12km"]+=1
     if d<=6:seed_counts[city]["6km"]+=1
   if hit:spatial[sid]=hit
  print("LOCAL_SEED_STOPS",len(spatial),flush=True)
  routes={}
  for r in read(z,"routes.txt"):
   rid=r.get("route_id","")
   if rid:routes[rid]=(mode_for(r.get("route_type")),r.get("route_short_name","")[:60])
  print("ROUTES_ALL",len(routes),flush=True)
  active_trips={}
  for r in read(z,"trips.txt"):
   rid=r.get("route_id","")
   sid=r.get("service_id","")
   trip=r.get("trip_id","")
   if rid in routes and sid in service_ids and trip:
    active_trips[trip]=rid
    if len(active_trips)>2_500_000:raise RuntimeError("ACTIVE_GTFS_TRIPS_OVER_MEMORY_CAP")
  print("ACTIVE_TRIPS_ALL",len(active_trips),flush=True)
  served=defaultdict(lambda:defaultdict(set))
  routes_by_city=defaultdict(lambda:defaultdict(set))
  stop_event_counts=defaultdict(lambda:defaultdict(int))
  found=0;scanned=0
  for r in read(z,"stop_times.txt"):
   scanned+=1
   hits=spatial.get(r.get("stop_id",""))
   if not hits:continue
   rid=active_trips.get(r.get("trip_id",""))
   if not rid:continue
   mode,line=routes.get(rid,("other",""))
   found+=1
   for city,km in hits:
    bucket="6km" if km<=6 else "6-12km"
    served[city][(bucket,mode)].add(r.get("stop_id",""))
    routes_by_city[city][(bucket,mode)].add(rid)
    stop_event_counts[city][(bucket,mode)]+=1
   if scanned%10_000_000==0:
    print("SCANNED_GTFS_STOP_TIMES",scanned,flush=True)
  print("SCAN_COMPLETE",scanned,"LOCAL_ACTIVE_STOP_TIME_EVENTS",found,flush=True)
  result=[]
  for city in CENTERS:
   bymode={}
   for mode in ("bus","train","suburban","tram","metro","ferry","other"):
    inside=(mode,"6km")
    s6=served[city].get(("6km",mode),set())
    s12=served[city].get(("6-12km",mode),set())
    bymode[mode]={"served_stops_6km":len(s6),
       "served_stops_12km":len(s6|s12),
       "routes_6km":len(routes_by_city[city].get(("6km",mode),set())),
       "stop_time_rows_6km":stop_event_counts[city].get(("6km",mode),0)}
   result.append({"place":city,"center":list(CENTERS[city]),
     "all_stops_6km":seed_counts[city]["6km"],"all_stops_12km":seed_counts[city]["12km"],
     "modes":bymode})
  return {"source_url":URL,"source_kind":"national GTFS schedule ZIP, not a live API",
   "generated_at":datetime.now(ZoneInfo("UTC")).isoformat(),
   "date_start":str(days[0]),"date_end":str(days[-1]),
   "caveats":["Active service means present on at least one day of the requested calendar window.",
    "Stop counts are not unique route pairs and do not demonstrate live departures.",
    "Includes nationwide feed's actual published scope, not guarantees of all German operators.",
    "Does not import, cache, or publish the raw GTFS ZIP."],"places":result}
def write_report(out:Path,record):
 out.mkdir(parents=True,exist_ok=True)
 (out/"de_nationwide_gap_audit.json").write_text(json.dumps(record,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
 lines=["# LifeDashPro NEXT — GTFS.de nationwide coverage discovery (READ ONLY)",
   "",f"Source: {record['source_url']}",f"GTFS dates: {record['date_start']} through {record['date_end']}",
   "No Supabase imports, no Android code changes. Numbers represent scheduled GTFS source coverage, not realtime.",
   "","| Place | Stops 6 km (all) | Active BUS stops 6 km | Active BUS routes 6 km | Train stops 6 km | Tram/Metro stops 6 km |",
   "|---|---:|---:|---:|---:|---:|"]
 for x in record["places"]:
  m=x["modes"]
  lines.append(f"| {x['place']} | {x['all_stops_6km']} | {m['bus']['served_stops_6km']} | {m['bus']['routes_6km']} | {m['train']['served_stops_6km'] + m['suburban']['served_stops_6km']} | {m['tram']['served_stops_6km'] + m['metro']['served_stops_6km']} |")
 lines+=["","## Interpretations","- A 0 means this dataset had no matched stops in the given window; other operators or APIs can still provide transit.",
   "- Check every candidate's licence and geographic validity before any cache import.",
   "- A source catalog record is metadata, not an integrated route or departure.",
   "- This is a one-shot resource-intensive discovery run; do not run it for every user search."]
 (out/"de_nationwide_gap_audit.md").write_text("\n".join(lines)+"\n",encoding="utf-8")
 print("\n".join(lines),flush=True)
def main():
 p=argparse.ArgumentParser()
 p.add_argument("--output-dir",type=Path,default=Path("audit-output"))
 p.add_argument("--zip",type=Path,help="Optional local fixture or existing archive; skips download")
 p.add_argument("--service-days",type=int,default=7)
 a=p.parse_args()
 if not 1<=a.service_days<=7:raise RuntimeError("SERVICE_DAYS_MUST_BE_1_TO_7")
 start=datetime.now(ZoneInfo("Europe/Berlin")).date()
 days=[start+timedelta(days=i) for i in range(a.service_days)]
 if a.zip:
  report=evaluate(a.zip,days);write_report(a.output_dir,report)
 else:
  with TemporaryDirectory(prefix="ldp-next-de-gtfs-audit-") as d:
   archive=Path(d)/"nv_free_latest.zip"
   n=download(archive);print("ARCHIVE_DOWNLOADED_MIB",round(n/1048576,2),flush=True)
   report=evaluate(archive,days);write_report(a.output_dir,report)
if __name__=="__main__":
 try:main()
 except Exception as exc:
  print("SAFE_AUDIT_FAILURE",type(exc).__name__,str(exc) if isinstance(exc,RuntimeError) else "no details",file=sys.stderr)
  raise SystemExit(1)
