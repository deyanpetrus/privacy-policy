#!/usr/bin/env python3
"""Quota-guarded atomic rolling refresh of ONLY the isolated NEW GTFS database.

The original LifeDashPro database/Edge v15 and NotesPro are never connected.
Unlike initial import, this intentionally refreshes populated GTFS tables.
One PostgreSQL transaction TRUNCATEs + imports + validates + COMMITs; if any
error, database rollback restores the entire previous live GTFS data.

A full refresh briefly takes ACCESS EXCLUSIVE locks, so use a quiet hour.
No external independent backup is created; do not consider this a disaster
recovery solution or move production reads here until a fallback is ready.
"""
from __future__ import annotations
import argparse
import json
import os
import sys
from datetime import date, datetime, timezone, timedelta
from pathlib import Path

import psycopg

from dedicated_gtfs_import import (PROJECT_REF, DB_SECRET, EXPECTED_FEED, TABLES,
   verify_target, check_manifest, run_import, sanitized_error_code, SafePreflightError)

REFRESH_WHEN_REMAINING_DAYS = 8
MIN_REFRESH_INTERVAL_DAYS = 4
QUOTA_MIB = 500
MAX_PEAK_MIB = 450
EXPECTED_RPC_COUNT = 4

def status(cur,*,local_fixture=False):
    cur.execute("""select current_database(),current_user,
      has_schema_privilege('anon','transit_data','USAGE'),
      has_schema_privilege('authenticated','transit_data','USAGE'),
      (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
       where n.nspname='transit_data' and c.relkind='r' and c.relrowsecurity),
      (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where n.nspname='public' and p.proname like 'transit_gtfs_%'
       and not has_function_privilege('anon',p.oid,'execute')
       and not has_function_privilege('authenticated',p.oid,'execute')
       and has_function_privilege('service_role',p.oid,'execute')),
      (select count(*) from pg_constraint fk
        join pg_class parent on parent.oid=fk.confrelid
        join pg_namespace pn on pn.oid=parent.relnamespace
        join pg_class child on child.oid=fk.conrelid
        join pg_namespace cn on cn.oid=child.relnamespace
        where fk.contype='f' and pn.nspname='transit_data' and cn.nspname!='transit_data')""")
    dbname,user,anon_access,user_access,rls,rpcs,external_refs=cur.fetchone()
    if local_fixture:
        # Never relax the safety gate for a remote database.
        # The disposable GitHub service has this unique local-only username/DB;
        # the caller must additionally validate the URL is loopback.
        if (dbname,user)!=("ldp_gtfs_scratch","ldp_gtfs_scratch"):
            raise SafePreflightError("REFRESH_LOCAL_FIXTURE_IS_NOT_LOCAL")
    if ((not local_fixture and (dbname,user)!=("postgres","postgres")) or
        anon_access or user_access or rls!=8 or rpcs!=EXPECTED_RPC_COUNT or external_refs):
        raise SafePreflightError("REFRESH_DESTINATION_OR_SECURITY_FAILED")
    cur.execute("""select feed_source,active,selected_from,selected_until,imported_at
                   from transit_data.feeds""")
    feeds=cur.fetchall()
    if len(feeds)!=1 or feeds[0][0]!=EXPECTED_FEED or feeds[0][1] is not True:
        raise SafePreflightError("REFRESH_ACTIVE_FEED_MISMATCH")
    cur.execute("select count(*) from transit_data.stop_times")
    n=cur.fetchone()[0]
    if n<(1 if local_fixture else 500_000) or n>(100 if local_fixture else 2_500_000):
        raise SafePreflightError("REFRESH_EXISTING_COVERAGE_INVALID")
    cur.execute("select pg_database_size(current_database())")
    db_bytes=int(cur.fetchone()[0])
    cur.execute("""select coalesce(sum(pg_total_relation_size(c.oid)),0)
       from pg_class c join pg_namespace n on n.oid=c.relnamespace
       where n.nspname='transit_data' and c.relkind='r'""")
    table_bytes=int(cur.fetchone()[0])
    # Only metadata may be logged, never DB host or secrets.
    return {"feed_source":feeds[0][0], "selected_from":feeds[0][2],
            "selected_until":feeds[0][3], "imported_at":feeds[0][4],
            "stop_times":n, "db_bytes":db_bytes, "table_bytes":table_bytes}

def should_refresh(state, today:date, force:bool=False):
    valid_to=state["selected_until"]
    if valid_to < today - timedelta(days=1):
        # Expiry is serious but still require a fresh validated replacement.
        return True
    if not force and (valid_to-today).days>REFRESH_WHEN_REMAINING_DAYS:
        return False
    if not force and state["imported_at"].date() >= today-timedelta(days=MIN_REFRESH_INTERVAL_DAYS):
        return False
    return True

def validate_new(state,manifest,today,*,local_fixture=False):
    selected=manifest["selection"]
    start=date.fromisoformat(selected["service_date"])
    if abs((start-today).days)>1:
        raise SafePreflightError("REFRESH_NOT_TODAY_SELECTION")
    new_until=start+timedelta(days=13)
    if new_until<=state["selected_until"]:
        raise SafePreflightError("REFRESH_NOT_EXTENDING_COVERAGE")
    counts=manifest["counts"]
    old=state["stop_times"]
    new=int(counts["stop_times"])
    if not 0.65*old<=new<=1.5*old:
        raise SafePreflightError("REFRESH_STOP_TIMES_COVERAGE_CHANGE")
    if not (1 if local_fixture else 500_000)<=new<=(100 if local_fixture else 2_500_000):
        raise SafePreflightError("REFRESH_STOP_TIMES_OUT_OF_RANGE")
    # Conservative peak projection: old files plus new table/index copies,
    # plus a 25% growth buffer. Unlike DELETE, TRUNCATE rolls back in one tx.
    projected=state["db_bytes"]+int(state["table_bytes"]*(new/old)*1.25)
    if projected>MAX_PEAK_MIB*1048576:
        raise SafePreflightError("REFRESH_PEAK_QUOTA_PROJECTION_FAILED")
    if state["db_bytes"]>=MAX_PEAK_MIB*1048576:
        raise SafePreflightError("REFRESH_DATABASE_NEAR_FREE_CAP")
    return {"new_until":new_until,"expected_stop_times":new,
            "estimated_peak_mib":round(projected/1048576,2)}

def refresh(cur,folder:Path,manifest,*,force_failure=False,local_fixture=False):
    """Caller owns a DB transaction. All GTFS writes are in that transaction."""
    cur.execute("select pg_try_advisory_xact_lock(820617,20261017)")
    if not cur.fetchone()[0]:
        raise SafePreflightError("REFRESH_LOCK_ALREADY_HELD")
    cur.execute("set local lock_timeout = '15s'")
    cur.execute("set local statement_timeout = '15min'")
    cur.execute("set local idle_in_transaction_session_timeout = '16min'")
    before=status(cur,local_fixture=local_fixture)
    today=datetime.now(timezone.utc).date()
    validated=validate_new(before,manifest,today,local_fixture=local_fixture)
    # ALL 8 tables, every FK chain included. NO CASCADE, NO DROP.
    # PostgreSQL TRUNCATE is TRANSACTIONAL, including RESTART IDENTITY.
    targets=", ".join("transit_data."+name for name in reversed(TABLES))
    cur.execute("truncate table "+targets+" restart identity")
    report=run_import(cur,folder,manifest,size_cap_mib=MAX_PEAK_MIB)
    after=status(cur,local_fixture=local_fixture)
    if after["stop_times"]!=validated["expected_stop_times"]:
        raise SafePreflightError("REFRESH_POSTIMPORT_COUNT_FAILED")
    if after["selected_until"]!=validated["new_until"]:
        raise SafePreflightError("REFRESH_POSTIMPORT_CALENDAR_FAILED")
    if after["db_bytes"]>MAX_PEAK_MIB*1048576:
        raise SafePreflightError("REFRESH_POSTIMPORT_QUOTA_EXCEEDED")
    # Ensure the freshly imported schedule can serve real Regensburg stations.
    cur.execute("""select count(*) from public.transit_gtfs_nearby(
                   49.0134::float8,12.1016::float8,1500,10)""")
    if cur.fetchone()[0]<2:
        raise SafePreflightError("REFRESH_NEARBY_SMOKE_FAILED")
    cur.execute("""select count(*) from transit_data.trips t
      left join transit_data.routes r on r.route_key=t.route_key
      where r.route_key is null""")
    if cur.fetchone()[0]:
        raise SafePreflightError("REFRESH_BROKEN_ROUTES")
    if force_failure:
        raise SafePreflightError("EXPECTED_TEST_ROLLBACK")
    return {"previous_until":str(before["selected_until"]),
            "new_until":str(after["selected_until"]),
            "previous_rows":before["stop_times"],"new_rows":after["stop_times"],
            "peak_mib":round(after["db_bytes"]/1048576,1),
            "projected_peak_mib":validated["estimated_peak_mib"],
            "report":report}

def plan_only(url,*,force=False):
    verify_target(url)
    with psycopg.connect(url,sslmode="require",connect_timeout=15,autocommit=True) as db:
        with db.cursor() as c:
            state=status(c)
    due=should_refresh(state,datetime.now(timezone.utc).date(),force=force)
    result={"due":due,"current_until":str(state["selected_until"]),
            "imported_at":state["imported_at"].date().isoformat(),
            "stop_times":state["stop_times"],
            "database_mib":round(state["db_bytes"]/1048576,1)}
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"],"a",encoding="utf-8") as f:
            f.write("refresh_needed="+str(due).lower()+"\n")
    print("DEDICATED_ROLLING_REFRESH_PLAN",json.dumps(result),flush=True)
    return result

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--confirm-project-ref",required=True)
    parser.add_argument("--plan-only",action="store_true")
    parser.add_argument("--dir",type=Path)
    args=parser.parse_args()
    if args.confirm_project_ref!=PROJECT_REF:
        raise SafePreflightError("PROJECT_REF_MISMATCH")
    if os.environ.get("LDP_TRANSIT_DB_URL"):
        raise SafePreflightError("OLD_PRODUCTION_SECRET_MUST_NOT_BE_PRESENT")
    url=os.environ.get(DB_SECRET,"")
    verify_target(url)
    preview=plan_only(url)
    if args.plan_only:
        return 0
    if not preview["due"]:
        print("DEDICATED_ROLLING_REFRESH_SKIPPED_CURRENT",flush=True)
        return 0
    if args.dir is None:
        raise SafePreflightError("REFRESH_MANIFEST_REQUIRED")
    manifest=check_manifest(args.dir)
    with psycopg.connect(url,sslmode="require",connect_timeout=15,autocommit=False) as db:
        try:
            with db.cursor() as cur:
                again=status(cur)
                if not should_refresh(again,datetime.now(timezone.utc).date()):
                    raise SafePreflightError("REFRESH_NO_LONGER_DUE")
                result=refresh(cur,args.dir,manifest)
            db.commit()
        except Exception:
            db.rollback()
            raise
    print("DEDICATED_ROLLING_REFRESH_COMMITTED",json.dumps(result),flush=True)
    return 0

if __name__=="__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print("DEDICATED_ROLLING_REFRESH_FAILED: "+
              sanitized_error_code(exc,"import")+
              " (rollback if transaction began; no credentials logged)",file=sys.stderr)
        raise SystemExit(1) from None
