#!/usr/bin/env python3
"""LifeDashPro Transit: Mobility Database metadata discovery -> dedicated Supabase.

Never downloads feed ZIPs or realtime binary payloads; never changes live transit.
Only writes RLS-protected transit_next.mobility_api_* index tables.
"""
from __future__ import annotations
import json,os,sys,time
from collections import Counter
from datetime import datetime,timezone
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.error import HTTPError,URLError
from urllib.parse import urlencode

BASE="https://api.mobilitydatabase.org/v1"
COUNTRIES=("DE","AT","CH","HR","RS","MK","BG","BA","AL","ME","SI","CZ","HU","IT","FR","PL")
GBFS_COUNTRIES=("DE","AT","CH","HR","SI")
ENDPOINTS=(("gtfs","gtfs_feeds",100,5),
           ("gtfs_rt","gtfs_rt_feeds",100,3),
           ("gbfs","gbfs_feeds",100,2))
MAX_RECORDS=6500
DB_GUARD_BYTES=340*1048576
OUT=Path(os.environ.get("RUNNER_TEMP","/tmp"))/"lifedashpro-mobility-api"
SECRET="MOBILITY_DATABASE_REFRESH_TOKEN"

def api(path,token=None,body=None):
    headers={"accept":"application/json","user-agent":"LifeDashPro-EU-Transit-Discovery/1.0"}
    if token:headers["authorization"]="Bearer "+token
    if body is not None:headers["content-type"]="application/json"
    req=Request(BASE+path,method="POST" if body is not None else "GET",headers=headers,
                data=json.dumps(body).encode("utf-8") if body is not None else None)
    for attempt in range(3):
        try:
            with urlopen(req,timeout=25) as res:
                if int(res.headers.get("Content-Length") or 0)>8*1048576:
                    raise RuntimeError("API_METADATA_PAGE_TOO_LARGE")
                raw=res.read(8*1048576+1)
                if len(raw)>8*1048576:raise RuntimeError("API_PAGE_EXCEEDS_LIMIT")
                return json.loads(raw)
        except HTTPError as exc:
            if exc.code in (429,502,503,504) and attempt<2:
                time.sleep(2**attempt*3)
                continue
            raise RuntimeError("MOBILITY_API_HTTP_"+str(exc.code)) from None
        except (URLError,TimeoutError) as exc:
            if attempt<2:
                time.sleep(2**attempt*3)
                continue
            raise RuntimeError("MOBILITY_API_UNREACHABLE_"+type(exc).__name__) from None
    raise RuntimeError("API_RETRIES_EXHAUSTED")

def clean(x,limit=180):
    return str(x or "").strip()[:limit]

def safe_date(x):
    v=clean(x,40)[:10]
    try:
        if len(v)==10 and datetime.strptime(v,"%Y-%m-%d"):return v
    except ValueError:pass
    return None

def safe_ts(x):
    s=clean(x,48)
    if not s:return None
    try:return datetime.fromisoformat(s.replace("Z","+00:00"))
    except ValueError:return None

def number(x):
    try:
        v=float(x)
        return round(v,3) if 0<=v<=1e6 else None
    except (TypeError,ValueError):return None

def normalize(feed,country,kind):
    if not isinstance(feed,dict):return None
    fid=clean(feed.get("id"),110)
    if not fid or not fid.startswith(("mdb-","tld-","tdg-","ntd-","jbda-","tfs-")):
        # Allow an unknown stable API id without inventing provider metadata.
        if not fid or "/" in fid or len(fid)>110:return None
    locations=feed.get("locations") if isinstance(feed.get("locations"),list) else []
    loc=next((l for l in locations if isinstance(l,dict) and l.get("country_code")==country),{})
    if not loc:loc=next((l for l in locations if isinstance(l,dict)),{})
    source=feed.get("source_info") if isinstance(feed.get("source_info"),dict) else {}
    latest=feed.get("latest_dataset") if isinstance(feed.get("latest_dataset"),dict) else {}
    auth=source.get("authentication_type")
    if isinstance(auth,bool) or auth not in (0,1,2,None):auth=None
    return (fid,country,kind,clean(feed.get("provider"),200),
            clean(feed.get("feed_name"),200),
            clean(feed.get("status"),30) or "unknown",
            feed.get("official") if isinstance(feed.get("official"),bool) else None,
            clean(loc.get("municipality"),140) or None,
            clean(loc.get("subdivision_name"),140) or None,
            clean(source.get("license_id"),90) or None,
            auth,clean(latest.get("id"),140) or None,
            safe_date(latest.get("service_date_range_start")),
            safe_date(latest.get("service_date_range_end")),
            safe_ts(latest.get("downloaded_at")),
            number(latest.get("zipped_folder_size_mb")))

def collect(token):
    records={}
    summaries=[]
    for country in COUNTRIES:
        for kind,endpoint,limit,pages in ENDPOINTS:
            if kind=="gbfs" and country not in GBFS_COUNTRIES:continue
            count=0
            completed=False
            for page in range(pages):
                query=urlencode({"country_code":country,"limit":limit,"offset":page*limit})
                rows=api("/"+endpoint+"?"+query,token=token)
                if not isinstance(rows,list):raise RuntimeError("UNEXPECTED_"+kind+"_API_PAGE_SHAPE")
                if len(rows)>limit:raise RuntimeError("UNBOUNDED_API_RESPONSE")
                for feed in rows:
                    record=normalize(feed,country,kind)
                    if record is None:continue
                    key=(record[0],country)
                    if key in records and records[key][2]!=kind:
                        raise RuntimeError("MOBILITY_ID_KIND_COLLISION")
                    records[key]=record
                count+=len(rows)
                if len(rows)<limit:
                    completed=True
                    break
                if len(records)>MAX_RECORDS:raise RuntimeError("CANDIDATE_INDEX_CAP_EXCEEDED")
            summaries.append((country,kind,count,"complete" if completed else "truncated"))
            print("MOBILITY_SCAN "+country+" "+kind+" count="+str(count)+" state="+("complete" if completed else "truncated"))
    if len(records)<20:raise RuntimeError("TOO_FEW_DISCOVERED_FEEDS")
    return records,summaries

def save(rows,scans):
    import psycopg
    sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
    from dedicated_gtfs_import import verify_target
    dsn=os.environ.get("LDP_DEDICATED_TRANSIT_DB_URL","")
    if not dsn:raise RuntimeError("DEDICATED_DATABASE_SECRET_MISSING")
    verify_target(dsn)
    with psycopg.connect(dsn,sslmode="require",connect_timeout=20) as db:
        with db.transaction():
            with db.cursor() as cur:
                cur.execute("select current_database(),current_user")
                if cur.fetchone()!=("postgres","postgres"):raise RuntimeError("INVALID_DEDICATED_DATABASE_ROLE")
                cur.execute("select pg_try_advisory_xact_lock(820617,20261115)")
                if cur.fetchone()[0] is not True:raise RuntimeError("MOBILITY_DISCOVERY_ALREADY_RUNNING")
                cur.execute("select pg_database_size(current_database())")
                if cur.fetchone()[0]>DB_GUARD_BYTES:raise RuntimeError("DEDICATED_FREE_DB_SAFETY_STOP")
                # No deletes and no updates to existing transit_data, sources or GTFS slots.
                cur.executemany("""
                   insert into transit_next.mobility_api_feeds (
                     feed_id,country_code,feed_kind,provider,feed_name,catalog_status,
                     official,municipality,subdivision,license_id,auth_type,latest_dataset_id,
                     service_start,service_end,downloaded_at,zipped_mb)
                   values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                   on conflict (feed_id,country_code) do update set
                     feed_kind=excluded.feed_kind,provider=excluded.provider,
                     feed_name=excluded.feed_name,catalog_status=excluded.catalog_status,
                     official=excluded.official,municipality=excluded.municipality,
                     subdivision=excluded.subdivision,license_id=excluded.license_id,
                     auth_type=excluded.auth_type,latest_dataset_id=excluded.latest_dataset_id,
                     service_start=excluded.service_start,service_end=excluded.service_end,
                     downloaded_at=excluded.downloaded_at,zipped_mb=excluded.zipped_mb,
                     last_seen_at=now()
                """,list(rows.values()))
                cur.executemany("""
                   insert into transit_next.mobility_api_country_checks
                     (country_code,feed_kind,latest_count,scan_state,last_checked_at)
                   values (%s,%s,%s,%s,now())
                   on conflict (country_code,feed_kind) do update set
                     latest_count=excluded.latest_count,scan_state=excluded.scan_state,
                     last_checked_at=excluded.last_checked_at
                """,scans)
                cur.execute("select count(*) from transit_next.mobility_api_feeds")
                stored=cur.fetchone()[0]
                if stored<len(rows):raise RuntimeError("FEED_METADATA_WRITE_NOT_VERIFIED")
                cur.execute("select pg_database_size(current_database())")
                if cur.fetchone()[0]>390*1048576:raise RuntimeError("FREE_DB_FINAL_QUOTA_GUARD")
    print("MOBILITY_DISCOVERY_SUPABASE_SUCCESS indexed="+str(len(rows))+" catalog_total="+str(stored))

def main():
    key=os.environ.get(SECRET,"").strip()
    if not key:raise RuntimeError("MOBILITY_REFRESH_TOKEN_MISSING")
    login=api("/tokens",body={"refresh_token":key})
    access=login.get("access_token") if isinstance(login,dict) else None
    if not isinstance(access,str) or len(access)<25:raise RuntimeError("MOBILITY_REFRESH_TOKEN_INVALID")
    print("MOBILITY_API_AUTH_OK")
    rows,summaries=collect(access)
    OUT.mkdir(parents=True,exist_ok=True)
    stats=Counter((x[2] for x in rows.values()))
    content={"checked_at":datetime.now(timezone.utc).isoformat(),"coverage":"curated 16 countries (subset of Europe)",
        "run_mode":"discovery_metadata_only","indexed":len(rows),"by_kind":dict(stats),
        "countries":[{"country":c,"kind":k,"count":n,"state":state} for c,k,n,state in summaries]}
    (OUT/"summary.json").write_text(json.dumps(content,indent=2)+"\n")
    lines=["## Mobility Database API catalog sync","",
           "Metadata ONLY: no GTFS ZIPs or realtime binary payloads; no cache/Android changes.","",
           "| Country | Feed type | Items | Coverage |","|---|---|---:|---|"]
    lines.extend("| "+c+" | "+k+" | "+str(n)+" | "+state+" |" for c,k,n,state in summaries)
    lines.extend(["",f"**Unique country/feed records:** {len(rows)}. **By kind:** {dict(stats)}."])
    (OUT/"summary.md").write_text("\n".join(lines)+"\n")
    if os.getenv("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"],"a") as f:f.write("\n".join(lines)+"\n")
    save(rows,summaries)

if __name__=="__main__":
    try:main()
    except Exception as e:
        print("MOBILITY_DISCOVERY_ABORT "+(str(e) if isinstance(e,RuntimeError) else type(e).__name__),file=sys.stderr)
        raise SystemExit(1)
