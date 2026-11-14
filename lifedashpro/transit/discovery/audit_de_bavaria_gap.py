#!/usr/bin/env python3
"""Safe, one-feed read-only audit of VGN Bavaria for LifeDashPro Transit.

Only downloads one ZIP into a temporary GitHub runner; no DB writes, no APK edits.
Do not confuse Neustadt an der Donau with Neustadt an der Aisch.
"""
import csv,io,json,os,sys,zipfile,urllib.request,urllib.error,datetime,math
from collections import Counter
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.parse import urlsplit
BASE="https://api.mobilitydatabase.org/v1"
FEED_ID="mdb-858"
MAX_COMPRESSED=25*1048576
MAX_EXPANDED=360*1048576
OUT=Path(os.getenv("RUNNER_TEMP","/tmp"))/"lifedashpro-vgn-gap"
COMPARE={
 "Neustadt an der Donau":{"lat":48.807,"lon":11.766,"radius":9},
 "Abensberg":{"lat":48.815,"lon":11.849,"radius":8},
 "Kelheim":{"lat":48.916,"lon":11.873,"radius":8},
 "Nuernberg":{"lat":49.452,"lon":11.077,"radius":8}
}
def request_json(path, token=None, body=None):
    h={"User-Agent":"LifeDashPro-Transit-Temporary-VGN-Audit/1.0","Accept":"application/json"}
    if token:h["Authorization"]="Bearer "+token
    if body is not None:h["Content-Type"]="application/json"
    req=urllib.request.Request(BASE+path,headers=h,method="POST" if body is not None else "GET",
                               data=json.dumps(body).encode() if body is not None else None)
    try:
        with urllib.request.urlopen(req,timeout=22) as r:
            return json.loads(r.read(800000).decode())
    except urllib.error.HTTPError as e:
        raise RuntimeError("MOBILITY_API_HTTP_"+str(e.code)) from None
def haversine(a,b,c,d):
    x,y=math.radians(c-a),math.radians(d-b)
    q=math.sin(x/2)**2+math.cos(math.radians(a))*math.cos(math.radians(c))*math.sin(y/2)**2
    return 6371*2*math.atan2(math.sqrt(q),math.sqrt(1-q))
def iter_csv(zf,path):
    if path not in zf.namelist():return
    with zf.open(path) as f:
        yield from csv.DictReader(io.TextIOWrapper(f,encoding="utf-8-sig",newline=""))
def ymd(s):
    try:return datetime.datetime.strptime(s,"%Y%m%d").date()
    except (ValueError,TypeError):return None
def main():
    refresh=os.getenv("MOBILITY_DATABASE_REFRESH_TOKEN","")
    if not refresh:raise RuntimeError("MOBILITY_REFRESH_TOKEN_SECRET_MISSING")
    access=request_json("/tokens",body={"refresh_token":refresh}).get("access_token","")
    if len(access)<25:raise RuntimeError("ACCESS_TOKEN_INVALID")
    details=request_json("/gtfs_feeds/"+FEED_ID,token=access)
    if details.get("id")!=FEED_ID or details.get("status")!="active":
        raise RuntimeError("FEED_NOT_ACTIVE")
    latest=details.get("latest_dataset") or {}
    if not isinstance(latest,dict):raise RuntimeError("NO_LATEST_DATASET")
    url=latest.get("hosted_url","")
    if not url and latest.get("id"):
        meta=request_json("/datasets/gtfs/"+str(latest["id"]),token=access)
        url=meta.get("hosted_url","") if isinstance(meta,dict) else ""
    parsed=urlsplit(url)
    if parsed.scheme!="https" or parsed.hostname not in ("storage.googleapis.com","storage.cloud.google.com"):
        # Print only hostname; do not expose redirects, query strings or tokens.
        raise RuntimeError("UNAPPROVED_DATASET_HOST_"+str(parsed.hostname or "missing")[:60])
    if not parsed.path.lower().endswith(".zip"):
        raise RuntimeError("UNEXPECTED_DATASET_EXTENSION")
    today=datetime.datetime.now(datetime.timezone.utc).date()
    end=(latest.get("service_date_range_end") or "")[:10]
    if end and end<str(today):raise RuntimeError("FEED_SERVICE_CALENDAR_EXPIRED")
    OUT.mkdir(parents=True,exist_ok=True)
    with TemporaryDirectory(prefix="vgn-gap-") as tmp:
        location=Path(tmp)/"vgn.zip"
        req=urllib.request.Request(url,headers={"User-Agent":"LifeDashPro-Transit-Temporary-VGN-Audit/1.0"})
        with urllib.request.urlopen(req,timeout=45) as src,open(location,"wb") as out:
            written=0
            while True:
                block=src.read(1*1048576)
                if not block:break
                written+=len(block)
                if written>MAX_COMPRESSED:raise RuntimeError("ZIP_MORE_THAN_25_MIB")
                out.write(block)
        with zipfile.ZipFile(location) as z:
            files=z.infolist()
            if len(files)>150 or sum(x.file_size for x in files)>MAX_EXPANDED:
                raise RuntimeError("EXPANDED_ZIP_EXCEEDS_360_MIB")
            if any(".." in f.filename.split("/") for f in files):
                raise RuntimeError("UNSAFE_ZIP_MEMBERS")
            must={"stops.txt","routes.txt","trips.txt","stop_times.txt"}
            if not must.issubset(set(z.namelist())):raise RuntimeError("INCOMPLETE_GTFS")
            areas={n:{"stops":0,"examples":[]} for n in COMPARE}
            types=Counter()
            for row in iter_csv(z,"routes.txt"):types[str(row.get("route_type","?"))]+=1
            stops=0
            for row in iter_csv(z,"stops.txt"):
                stops+=1
                try:lat,lon=float(row["stop_lat"]),float(row["stop_lon"])
                except (KeyError,ValueError,TypeError):continue
                for name,p in COMPARE.items():
                    if haversine(lat,lon,p["lat"],p["lon"])<=p["radius"]:
                        areas[name]["stops"]+=1
                        if len(areas[name]["examples"])<6:
                            areas[name]["examples"].append(str(row.get("stop_name",""))[:90])
            trips=sum(1 for _ in iter_csv(z,"trips.txt"))
            active={today+datetime.timedelta(days=d):set() for d in range(3)}
            for r in iter_csv(z,"calendar.txt"):
                first,last=ymd(r.get("start_date")),ymd(r.get("end_date"))
                if not first or not last:continue
                for day in active:
                    dow=("monday","tuesday","wednesday","thursday","friday","saturday","sunday")[day.weekday()]
                    if first<=day<=last and r.get(dow)=="1":active[day].add(r.get("service_id"))
            for r in iter_csv(z,"calendar_dates.txt"):
                day=ymd(r.get("date"))
                if day not in active:continue
                if r.get("exception_type")=="1":active[day].add(r.get("service_id"))
                if r.get("exception_type")=="2":active[day].discard(r.get("service_id"))
            res={"feed_id":FEED_ID,"provider":str(details.get("provider",""))[:130],
                 "source":"Mobility Database hosted latest GTFS; VGN official license CC BY 3.0 DE",
                 "license_attribution":"VGN – Verkehrsverbund Großraum Nürnberg GmbH",
                 "status":"audit_only_not_imported","zip_mib":round(written/1048576,3),
                 "routes":sum(types.values()),"route_types":dict(types),"trips":trips,"stops":stops,
                 "service_dates":{str(day):len(active[day]) for day in active},
                 "areas":areas,
                 "notes":"Geographic stop presence is not proof of complete route/valid departure coverage."}
    (OUT/"vgn-gap-audit.json").write_text(json.dumps(res,indent=2,ensure_ascii=False)+"\n")
    lines=["## VGN static GTFS — read-only geographical gap audit","","No DB writes / no Android/production changes. ZIP destroyed with runner temp folder.","",
           "| Locality | Stops in approximate radius | Examples |","|---|---:|---|"]
    for n,v in areas.items():lines.append("| "+n+" | "+str(v["stops"])+" | "+", ".join(v["examples"]).replace("|","/")+" |")
    lines.extend(["","### Feed validity",
                  "Dates: "+str(res["service_dates"]),
                  "GTFS: "+str(res["routes"])+" routes / "+str(stops)+" stops / "+str(trips)+" trips.",
                  "License: CC BY 3.0 DE; attribution VGN – Verkehrsverbund Großraum Nürnberg GmbH.",
                  "This audit does not activate or import ANY feed."])
    report="\n".join(lines)+"\n"
    (OUT/"vgn-gap-audit.md").write_text(report)
    if os.getenv("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"],"a") as f:f.write(report)
    print("VGN_GAP_AUDIT_OK "+json.dumps({"routes":res["routes"],"stops":stops,"trips":trips,
           "areas":{x:y["stops"] for x,y in areas.items()},"service_days":res["service_dates"]},sort_keys=True))
if __name__=="__main__":
    try:main()
    except Exception as e:
        print("VGN_GAP_AUDIT_STOP "+(str(e) if isinstance(e,RuntimeError) else type(e).__name__),file=sys.stderr)
        raise SystemExit(1)
