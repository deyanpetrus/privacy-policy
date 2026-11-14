#!/usr/bin/env python3
"""LifeDashPro Transit: metadata-only European mobility feed discovery.

NEVER downloads GTFS ZIP/GTFS-RT payloads, changes live transit data, or
promotes a feed. A successful HTTP HEAD does NOT mean a valid timetable.
"""
from __future__ import annotations
import argparse
import concurrent.futures
import datetime as dt
import ipaddress
import json
import os
import sys
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, build_opener, HTTPRedirectHandler

CATALOG=Path(__file__).with_name("catalog.json")
OUTDIR=Path(os.environ.get("RUNNER_TEMP","/tmp"))/"lifedashpro-discovery"
MAX_WORKERS=4
REQUEST_TIMEOUT=12
DATABASE_LIMIT_BYTES=430*1048576

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self,req,fp,code,msg,headers,newurl):
        return None

def validate_url(value):
    try:
        u=urlsplit(value)
        if u.scheme!="https" or u.username or u.password or not u.hostname or u.port not in (None,443):
            raise ValueError("unsafe URL")
        host=u.hostname.lower()
        if host=="localhost" or host.endswith((".local",".internal",".localhost")) or "." not in host:
            raise ValueError("unsafe hostname")
        try:
            ipaddress.ip_address(host)
        except ValueError:
            pass
        else:
            raise ValueError("IP literal URLs disabled")
    except Exception as exc:
        raise ValueError("unsafe URL in curated registry") from exc

def load_catalog():
    data=json.loads(CATALOG.read_text(encoding="utf-8"))
    rows=data["sources"]
    if data["schema_version"]!=1 or len(rows)!=24 or len(data["reference_links"])!=5:
        raise RuntimeError("UNEXPECTED_REGISTRY_SHAPE")
    ids=set()
    for r in rows:
        if r["id"] in ids or not 1<=r["refresh_hours"]<=720:
            raise RuntimeError("DUPLICATE_OR_BAD_INTERVAL")
        ids.add(r["id"])
        if r["kind"] not in {"gtfs","gtfs_rt","gbfs"}:raise RuntimeError("UNKNOWN_FORMAT")
        validate_url(r["catalog_url"])
        validate_url(r["probe_url"])
    return rows

def check_one(row):
    stamp=dt.datetime.now(dt.timezone.utc)
    result={"id":row["id"],"checked_at":stamp.isoformat(),"state":"not_checked",
            "http_code":None,"content_length":None,"last_modified":None,"note":""}
    url=row["probe_url"]
    opener=build_opener(NoRedirect)
    last_error=None
    for method in ("HEAD","GET"):
        headers={"User-Agent":"LifeDashPro-SourceDiscovery/1.0 (metadata only)",
                 "Accept":"application/json,application/zip,application/octet-stream,*/*"}
        if method=="GET":headers["Range"]="bytes=0-0"
        req=Request(url,method=method,headers=headers)
        try:
            with opener.open(req,timeout=REQUEST_TIMEOUT) as response:
                code=response.status
                result.update(http_code=code,
                    content_length=parse_len(response.headers.get("Content-Length")),
                    last_modified=(response.headers.get("Last-Modified") or "")[:100],
                    state="http_reachable_not_validated",
                    note="HTTP response only; format/calendar/license NOT validated")
                return result
        except HTTPError as e:
            code=e.code
            result["http_code"]=code
            if code in (301,302,303,307,308):
                result["state"]="redirect_unverified"
                result["note"]="Publisher redirected; URL/target not automatically followed"
                return result
            if code in (401,403):
                result["state"]="auth_or_access_required"
                result["note"]="Producer may require API key or restrict automated probes"
                return result
            if code in (405,501) and method=="HEAD":
                continue
            if code in (404,410):
                result["state"]="not_found"
                result["note"]="Producer returned not found (do not delete existing data)"
                return result
            last_error="HTTP_"+str(code)
            if method=="HEAD":continue
        except (URLError,TimeoutError,OSError) as e:
            last_error=type(e).__name__
            if method=="HEAD":continue
        except Exception as e:
            last_error=type(e).__name__
            break
    result["state"]="probe_failed"
    result["note"]="Failed to verify network reachability: "+str(last_error or "unknown")
    return result

def parse_len(s):
    try:
        x=int(s)
        return x if 0<=x<=10**12 else None
    except (ValueError,TypeError):
        return None

def report(rows,checks):
    OUTDIR.mkdir(parents=True,exist_ok=True)
    checked={r["id"]:r for r in checks}
    report=[]
    header=["# LifeDashPro Europe Transit Source Registry",
            "",f"Generated: {dt.datetime.now(dt.timezone.utc).isoformat()}",
            "", "**Important:** Reachable URL is not a valid or licensed transit timetable. **No feed content is imported.**",
            "", "| Country | Source | Kind | Integration policy | HTTP probe | Next check |",
            "|---|---|---|---|---|---|"]
    lines=list(header)
    for x in rows:
        z=checked[x["id"]]
        next_t=dt.datetime.fromisoformat(z["checked_at"])+dt.timedelta(hours=x["refresh_hours"])
        lines.append("| "+ " | ".join([
            x["regions"].replace("|","/"),x["name"].replace("|","/"),x["kind"],x["policy"],
            z["state"]+" ("+(str(z["http_code"]) if z["http_code"] is not None else "—")+")",
            next_t.strftime("%Y-%m-%d %H:%M UTC")])+" |")
        report.append({**x,**{"probe":z,"next_check_at":next_t.isoformat()}})
    summary="\n".join(lines)+"\n"
    (OUTDIR/"status.md").write_text(summary,encoding="utf-8")
    (OUTDIR/"status.json").write_text(json.dumps({"generated_at":dt.datetime.now(dt.timezone.utc).isoformat(),
        "safety":"metadata-only,no-import,no-Android-changes","feeds":report},ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    gh=os.getenv("GITHUB_STEP_SUMMARY")
    if gh:
        with open(gh,"a",encoding="utf-8") as f:f.write(summary)
    print("REGISTRY_PROBE_COMPLETE "+json.dumps({"feeds":len(rows),"states":{s:sum(1 for x in checks if x["state"]==s)
        for s in sorted({x["state"] for x in checks})}},sort_keys=True))
    return checked

def save_to_dedicated_db(rows,checked):
    import psycopg
    sys.path.insert(0,str(CATALOG.parent.parent))
    from dedicated_gtfs_import import verify_target
    url=os.environ.get("LDP_DEDICATED_TRANSIT_DB_URL","")
    if not url:raise RuntimeError("DEDICATED_DB_SECRET_MISSING")
    verify_target(url)
    with psycopg.connect(url,sslmode="require",connect_timeout=20) as con:
        with con.transaction():
            with con.cursor() as cur:
                cur.execute("select current_database(),current_user")
                if cur.fetchone()!=("postgres","postgres"):
                    raise RuntimeError("WRONG_DEDICATED_DB_ROLE")
                cur.execute("select pg_try_advisory_xact_lock(820617,20261114)")
                if cur.fetchone()[0] is not True:raise RuntimeError("DISCOVERY_UPDATE_ALREADY_RUNNING")
                cur.execute("select pg_database_size(current_database())")
                if cur.fetchone()[0]>=DATABASE_LIMIT_BYTES:raise RuntimeError("DB_TOO_CLOSE_TO_FREE_QUOTA")
                for row in rows:
                    probe=checked[row["id"]]
                    when=dt.datetime.fromisoformat(probe["checked_at"])
                    next_t=when+dt.timedelta(hours=row["refresh_hours"])
                    cur.execute("""
                       insert into transit_next.discovery_sources
                         (feed_id,display_name,category,regions,catalog_url,probe_url,
                          integration_policy,license_note,refresh_hours,notes,
                          probe_state,last_checked_at,next_check_at,http_code,content_length,http_last_modified,last_error)
                       values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                       on conflict (feed_id) do update set
                         display_name=excluded.display_name,category=excluded.category,
                         regions=excluded.regions,catalog_url=excluded.catalog_url,probe_url=excluded.probe_url,
                         integration_policy=excluded.integration_policy,license_note=excluded.license_note,
                         refresh_hours=excluded.refresh_hours,notes=excluded.notes,
                         probe_state=excluded.probe_state,last_checked_at=excluded.last_checked_at,
                         next_check_at=excluded.next_check_at,http_code=excluded.http_code,
                         content_length=excluded.content_length,http_last_modified=excluded.http_last_modified,
                         last_error=excluded.last_error,updated_at=now()
                       """,(row["id"],row["name"],row["kind"],row["regions"],row["catalog_url"],row["probe_url"],
                            row["policy"],row["license"],row["refresh_hours"],row["notes"],
                            probe["state"],when,next_t,probe["http_code"],probe["content_length"],probe["last_modified"],
                            probe["note"][:240] if probe["state"] not in ("http_reachable_not_validated",) else None))
                    cur.execute("""
                        insert into transit_next.discovery_checks
                          (feed_id,checked_at,probe_state,http_code,content_length,note)
                        values (%s,%s,%s,%s,%s,%s)
                        """,(row["id"],when,probe["state"],probe["http_code"],probe["content_length"],probe["note"][:240]))
                cur.execute("delete from transit_next.discovery_checks where checked_at < now() - interval '45 days'")
                cur.execute("select count(*) from transit_next.discovery_sources where feed_id=any(%s)",([x["id"] for x in rows],))
                if cur.fetchone()[0]!=len(rows):raise RuntimeError("REGISTRY_WRITE_VERIFY_FAILED")
    print("DEDICATED_DISCOVERY_CATALOG_COMMITTED "+str(len(rows)))

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--mode",choices=["check","validate"],default="validate")
    a=p.parse_args()
    rows=load_catalog()
    if a.mode=="validate":
        print("CATALOG_VALIDATED "+str(len(rows))+" feeds + 5 reference URLs; no network, no DB writes")
        return
    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
        results=list(ex.map(check_one,rows))
    checked=report(rows,results)
    save_to_dedicated_db(rows,checked)

if __name__=="__main__":
    try:main()
    except Exception as e:
        # No connection strings, bearer tokens, or full server exception text in logs.
        print("DISCOVERY_ABORT_"+type(e).__name__+" "+(str(e) if isinstance(e,RuntimeError) else ""),
              file=sys.stderr)
        sys.exit(1)
