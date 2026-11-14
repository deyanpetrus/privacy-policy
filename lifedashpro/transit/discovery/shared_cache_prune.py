#!/usr/bin/env python3
"""Prune ONLY expired LifeDashPro NEXT shared transit lookup cache in dedicated Free DB.

No live GTFS/stops/routes, legacy app, history or source registry changes.
"""
from __future__ import annotations
import os,sys
from pathlib import Path
import psycopg
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from dedicated_gtfs_import import verify_target

def main():
    dsn=os.environ.get("LDP_DEDICATED_TRANSIT_DB_URL","")
    if not dsn:raise RuntimeError("DEDICATED_DB_SECRET_MISSING")
    verify_target(dsn)
    with psycopg.connect(dsn,sslmode="require",connect_timeout=20) as con:
        with con.transaction():
            with con.cursor() as cur:
                cur.execute("select current_database(),current_user")
                if cur.fetchone()!=("postgres","postgres"):
                    raise RuntimeError("WRONG_DEDICATED_DB_OR_ROLE")
                cur.execute("select pg_try_advisory_xact_lock(820617,20261116)")
                if not cur.fetchone()[0]:raise RuntimeError("TRANSIT_CACHE_PRUNE_ALREADY_RUNNING")
                cur.execute("select pg_size_pretty(pg_database_size(current_database()))")
                before=cur.fetchone()[0]
                cur.execute("select count(*) from transit_next.shared_lookup_cache_v1")
                n0=cur.fetchone()[0]
                cur.execute("select public.transit_shared_cache_prune_v1(1000)")
                deleted=cur.fetchone()[0]
                cur.execute("select count(*),pg_total_relation_size('transit_next.shared_lookup_cache_v1'::regclass) from transit_next.shared_lookup_cache_v1")
                n1,bytes_used=cur.fetchone()
                if n1>n0 or deleted>1000:raise RuntimeError("UNEXPECTED_TRANSIT_CACHE_PRUNE_COUNTS")
    report=f"TRANSIT_SHARED_CACHE_PRUNE_OK expired_deleted={deleted} rows_remaining={n1} table_bytes={bytes_used} db_pre={before}"
    print(report)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"],"a",encoding="utf-8") as f:
            f.write("### LifeDashPro NEXT shared transit cache health\n\n")
            f.write(f"- Expired entries cleaned: {deleted}\n- Current entries: {n1}\n")
            f.write(f"- Cache relation: {bytes_used:,} bytes\n- Dedicated project database (pre-cleanup): {before}\n")
            f.write("- Only the private transit_next.shared_lookup_cache_v1 table was touched.\n")

if __name__=="__main__":
    try:main()
    except Exception as e:
        print("TRANSIT_CACHE_PRUNE_FAILED "+(str(e) if isinstance(e,RuntimeError) else type(e).__name__),file=sys.stderr)
        raise SystemExit(1)
