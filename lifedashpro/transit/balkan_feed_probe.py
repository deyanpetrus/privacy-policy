#!/usr/bin/env python3
"""Read-only LifeDashPro Balkan feed probe. NO Supabase, Android or GTFS import."""
import csv, datetime as dt, hashlib, io, json, pathlib, re, sys, urllib.request, zipfile
from urllib.parse import urlparse

REGISTRY="https://raw.githubusercontent.com/public-transport/transitous/main/feeds/{}.json"
MK_RAIL_CATALOG="https://raw.githubusercontent.com/MobilityData/mobility-database-catalogs/main/catalogs/sources/gtfs/schedule/mk-municipality-of-chashka-north-macedonia-railways-transport-gtfs-3461.json"
SELECT={"bg":["bdz","varna","plovdiv","stara-zagora","dobrich","yambol","kazanlak","sliven"],"ba":["Sarajevo-MSKS","Mostar","Centrotrans","livnobus"],"mk":["zr-north-macedonia","jsp"]}
MAX_BYTES=24*1024*1024
HEAD={"User-Agent":"LifeDashPro/FeedProbe (https://mkdigital.app/; no production imports)"}
OUT=pathlib.Path("out")
OUT.mkdir(exist_ok=True)
CCBY=OUT/"ccby"
CCBY.mkdir(exist_ok=True)
TODAY=dt.datetime.now(dt.timezone.utc).date().strftime("%Y%m%d")

def fetch(url,cap=MAX_BYTES):
    if not url.startswith("https://"):raise ValueError("Only HTTPS URLs are allowed")
    with urllib.request.urlopen(urllib.request.Request(url,headers=HEAD),timeout=28) as resp:
        if urlparse(resp.geturl()).scheme!="https":raise ValueError("Non-HTTPS redirect")
        length=resp.headers.get("Content-Length")
        if length and int(length)>cap:raise ValueError("Too large")
        chunks=[];size=0
        while True:
            data=resp.read(256*1024)
            if not data:break
            size+=len(data)
            if size>cap:raise ValueError("Download above cap")
            chunks.append(data)
        return b"".join(chunks)

def registry(url):
    return json.loads(fetch(url,1024*1024).decode("utf-8-sig"))

def checked_zip(raw):
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        files=z.infolist()
        if len(files)>120 or sum(x.file_size for x in files)>250*1024*1024:raise ValueError("Unsafe expanded ZIP")
        for f in files:
            p=pathlib.PurePosixPath(f.filename)
            if p.is_absolute() or ".." in p.parts or "\\" in f.filename:raise ValueError("Unsafe ZIP path")
            if (f.external_attr>>16)&0o170000==0o120000:raise ValueError("ZIP symlink")
        names={pathlib.PurePosixPath(f.filename).name.lower():f.filename for f in files if not f.is_dir()}
        keys=["stops.txt","routes.txt","trips.txt","stop_times.txt"]
        if not all(k in names for k in keys):raise ValueError("Missing required GTFS files")
        rows={}
        for key in keys:
            with z.open(names[key]) as f:
                rows[key]=max(0,sum(piece.count(b"\n") for piece in iter(lambda:f.read(1024*1024),b""))-1)
        if min(rows.values())<1:raise ValueError("Empty GTFS required file")
        date_list=[]
        for key,columns in (("calendar.txt",("start_date","end_date")),("calendar_dates.txt",("date",))):
            if key in names:
                with z.open(names[key]) as stream:
                    reader=csv.DictReader(io.TextIOWrapper(stream,encoding="utf-8-sig",errors="replace"))
                    for i,row in enumerate(reader):
                        if i>=250000:break
                        for col in columns:
                            val=row.get(col,"")
                            if re.fullmatch(r"20\d{6}",val):date_list.append(val)
        lo=min(date_list) if date_list else None
        hi=max(date_list) if date_list else None
        return {"stops":rows["stops.txt"],"routes":rows["routes.txt"],"trips":rows["trips.txt"],
                "stop_times":rows["stop_times.txt"],"first":lo,"last":hi,
                "calendar_covers_today":bool(lo and hi and lo<=TODAY<=hi)}

def mk_rail_url():
    data=registry(MK_RAIL_CATALOG)
    url=data.get("urls",{}).get("direct_download","")
    if not url.startswith("https://github.com/deryclem/gtfs-north-macedonia/"):
        raise ValueError("mdb-3461 original URL changed")
    return url

items=[]
for country,names in SELECT.items():
    try:
        catalog=registry(REGISTRY.format(country))
        sources=catalog.get("sources",[])
    except Exception as exc:
        items.append({"country":country,"name":"REGISTRY","state":"catalog_error","error":str(exc)[:180]})
        continue
    for name in names:
        for src in [s for s in sources if s.get("name")==name]:
            kind="rt" if src.get("spec")=="gtfs-rt" else "gtfs"
            if src.get("type")=="mobility-database" and src.get("mdb-id")!="mdb-3461":continue
            label=country+"_"+name+("_rt" if kind=="rt" else "")
            licence=(src.get("license") or {}).get("spdx-identifier","UNKNOWN")
            row={"country":country,"name":name,"type":kind,"license":licence,
                 "source":src.get("url") or src.get("mdb-id"),"production_imported":False}
            try:
                url=mk_rail_url() if src.get("mdb-id")=="mdb-3461" else src.get("url")
                if not url:raise ValueError("No URL in catalog")
                content=fetch(url,7*1024*1024 if kind=="rt" else MAX_BYTES)
                row.update(bytes=len(content),sha256=hashlib.sha256(content).hexdigest())
                if kind=="rt":
                    row["state"]="rt_retrieved_not_parsed" if len(content)>10 else "rt_empty"
                else:
                    meta=checked_zip(content)
                    row.update(meta)
                    row["state"]="gtfs_valid_date_range" if meta["calendar_covers_today"] else "gtfs_valid_but_not_current"
                    if licence=="CC-BY-4.0":
                        path=CCBY/(label+".zip")
                        path.write_bytes(content)
                        row["saved_test_zip"]=path.name
            except Exception as exc:
                row["state"]="failed"
                row["error"]=str(exc)[:180]
            items.append(row)
            print(country,name,kind,row["state"],row.get("stops",""),row.get("error",""),flush=True)

(OUT/"report.json").write_text(json.dumps({"asof_utc":TODAY,"imported":False,"feeds":items},ensure_ascii=False,indent=2),encoding="utf-8")
md=["# LifeDashPro Balkan GTFS probe","","Date "+TODAY+" (UTC). No Supabase/Android changes.",
"","| Country | Feed | Type | State | Stops | Routes | Trips | Valid until | Licence |",
"|---|---|---|---|---:|---:|---:|---|---|"]
for r in items:
    vals=[r["country"].upper(),r["name"],r.get("type",""),r["state"],str(r.get("stops","—")),str(r.get("routes","—")),str(r.get("trips","—")),str(r.get("last") or "—"),r.get("license","—")]
    md.append("| "+" | ".join(v.replace("|","/") for v in vals)+" |")
md+=["","UNKNOWN licence feeds were only inspected and are never saved as binary artifacts.",
"GTFS-RT fetched does not mean verified LIVE; protobuf semantics not parsed.",
"Validity date range is NOT proof of active service on a particular route.",
"Keep existing Supabase feeds; never replace good data on download failure.",
"Attribution required for all retained CC BY 4.0 datasets (original provider and livetransport.eu, where applicable)."]
(OUT/"report.md").write_text("\n".join(md)+"\n",encoding="utf-8")
print("PROBE_COMPLETE",len(items),"rows")
