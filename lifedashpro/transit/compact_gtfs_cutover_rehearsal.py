#!/usr/bin/env python3
"""Transactional GTFS compatibility-view cutover/rollback rehearsal.

Only for a disposable GitHub Actions PostgreSQL instance. NEVER for production.
Run after compact_gtfs_benchmark.py and compact_gtfs_api_parity.py.
No production credentials or Supabase tables, functions, or schemas are accessed.
"""
from __future__ import annotations

import argparse
import json
import os
import time
from pathlib import Path

import psycopg

from compact_gtfs_benchmark import validate_local_url, EXPECTED_DB, EXPECTED_USER

LEGACY_VIEW = """
create or replace view runtime_bench.stop_times as
select st.feed_source, st.trip_id, st.stop_sequence, st.stop_id,
       st.arrival_time, st.departure_time, st.arrival_secs, st.departure_secs,
       st.stop_headsign, st.pickup_type, st.drop_off_type
from legacy_bench.stop_times st
"""

# PostgreSQL integer GTFS seconds are enough to reproduce HH:MM:SS values,
# including departures after midnight (e.g. 25:13:00).
def gtfs_time(expr: str) -> str:
    return ("case when " + expr + " is null then null else "
        "lpad((" + expr + " / 3600)::text,2,'0') || ':' || "
        "lpad(((" + expr + " / 60) % 60)::text,2,'0') || ':' || "
        "lpad((" + expr + " % 60)::text,2,'0') end")

COMPACT_VIEW = """
create or replace view runtime_bench.stop_times as
select tm.feed_source,tm.trip_id,st.stop_sequence,sm.stop_id,
       """ + gtfs_time("st.arrival_secs") + """ as arrival_time,
       """ + gtfs_time("st.departure_secs") + """ as departure_time,
       st.arrival_secs,st.departure_secs,
       st.stop_headsign,st.pickup_type::integer as pickup_type,
       st.drop_off_type::integer as drop_off_type
from compact_bench.stop_times st
join compact_bench.trips tm on tm.trip_key=st.trip_key
join compact_bench.stops sm on sm.stop_key=st.stop_key
"""

SAMPLE = """
select trip_id,stop_sequence,stop_id,arrival_time,departure_time,
       arrival_secs,departure_secs,stop_headsign,pickup_type,drop_off_type
from runtime_bench.stop_times
where feed_source='de-national' and trip_id=%s
order by stop_sequence
"""

FULL_FIDELITY = """
select count(*) as matched, count(*) filter (
  where c.trip_id is null or
        c.stop_id is distinct from st.stop_id or
        c.arrival_time is distinct from st.arrival_time or
        c.departure_time is distinct from st.departure_time or
        c.arrival_secs is distinct from st.arrival_secs or
        c.departure_secs is distinct from st.departure_secs or
        c.stop_headsign is distinct from st.stop_headsign or
        c.pickup_type is distinct from st.pickup_type or
        c.drop_off_type is distinct from st.drop_off_type
) as differences
from legacy_bench.stop_times st
left join runtime_bench.stop_times c
  on c.feed_source=st.feed_source and c.trip_id=st.trip_id
  and c.stop_sequence=st.stop_sequence
"""

def sample_results(cur, trip_ids):
    results=[]
    for trip_id in trip_ids:
        cur.execute(SAMPLE,(trip_id,))
        results.append((trip_id,cur.fetchall()))
    return results

def view_origin(cur):
    cur.execute("""select definition from pg_views
                   where schemaname='runtime_bench' and viewname='stop_times'""")
    row=cur.fetchone()
    if row is None:
        raise RuntimeError("Missing runtime compatibility view")
    definition=row[0]
    if "legacy_bench.stop_times" in definition:
        return "legacy"
    if "compact_bench.stop_times" in definition:
        return "compact"
    raise RuntimeError("Runtime view target unknown")

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--db-url",required=True)
    parser.add_argument("--dir",type=Path,required=True)
    parser.add_argument("--report",type=Path,required=True)
    args=parser.parse_args()
    validate_local_url(args.db_url)
    if os.environ.get("LDP_TRANSIT_DB_URL"):
        raise RuntimeError("Production credentials are forbidden in this rehearsal")
    meta=json.loads((args.dir/"manifest.json").read_text(encoding="utf-8"))
    if meta.get("feed_source")!="de-national":
        raise RuntimeError("Unexpected GTFS feed")
    expected=int(meta["counts"]["stop_times"])
    if not 5000<expected<=2500000:
        raise RuntimeError("Unexpected fact table volume")
    with psycopg.connect(args.db_url,autocommit=True,connect_timeout=10) as conn:
        with conn.cursor() as cur:
            cur.execute("select current_database(),current_user,inet_server_addr()")
            db,user,server=cur.fetchone()
            if (db,user)!=(EXPECTED_DB,EXPECTED_USER):
                raise RuntimeError("Disallowed database")
            cur.execute("""select
                to_regclass('legacy_bench.stop_times'),
                to_regclass('compact_bench.stop_times'),
                to_regclass('legacy_bench.routes'),
                to_regclass('compact_bench.routes'),
                to_regnamespace('runtime_bench')""")
            schema_state=cur.fetchone()
            if any(item is None for item in schema_state[:4]) or schema_state[4] is not None:
                raise RuntimeError("Full parity benchmark must run first; runtime schema must be fresh")
            cur.execute("select count(*) from legacy_bench.stop_times")
            if cur.fetchone()[0]!=expected:
                raise RuntimeError("Missing original GTFS dataset")
            cur.execute("select count(*) from compact_bench.stop_times")
            if cur.fetchone()[0]!=expected:
                raise RuntimeError("Missing converted GTFS dataset")

            cur.execute("select trip_id from legacy_bench.stop_times group by trip_id order by count(*) desc, trip_id limit 12")
            trip_ids=[r[0] for r in cur.fetchall()]
            if len(trip_ids)!=12:
                raise RuntimeError("Not enough samples")
            cur.execute("create schema runtime_bench")
            cur.execute(LEGACY_VIEW)
            before=sample_results(cur,trip_ids)
            if view_origin(cur)!="legacy":
                raise RuntimeError("Legacy starting state not established")
            cur.execute("select count(*) from runtime_bench.stop_times")
            if cur.fetchone()[0]!=expected:
                raise RuntimeError("Legacy runtime count differs")

            # Rollback the attempted *view switch*, proving old provider stays
            # queryable if a transaction fails before COMMIT.
            cur.execute("begin")
            cur.execute(COMPACT_VIEW)
            if view_origin(cur)!="compact":
                raise RuntimeError("Compact view did not install inside transaction")
            cur.execute("rollback")
            if view_origin(cur)!="legacy" or sample_results(cur,trip_ids)!=before:
                raise RuntimeError("ROLLBACK FAILED to preserve legacy routing")

            # Committed switch is an atomic DDL transaction in scratch PostgreSQL.
            cur.execute("begin")
            cur.execute(COMPACT_VIEW)
            cur.execute("commit")
            if view_origin(cur)!="compact":
                raise RuntimeError("Committed switch did not expose compact rows")
            if sample_results(cur,trip_ids)!=before:
                raise RuntimeError("Compact cutover changed sampled trip paths or times")
            cur.execute("select count(*) from runtime_bench.stop_times")
            compact_rows=cur.fetchone()[0]
            if compact_rows!=expected:
                raise RuntimeError("Compact compatibility view count mismatch")

            # Exhaustive API-compatibility check, including reconstructed
            # GTFS HH:MM:SS strings, not just second counts or stop IDs.
            started=time.monotonic()
            cur.execute(FULL_FIDELITY)
            matched,differences=cur.fetchone()
            duration=round(time.monotonic()-started,2)
            if matched!=expected or differences!=0:
                raise RuntimeError("Full cutover compatibility mismatch: " +
                    str(matched)+" rows, "+str(differences)+" differences")

            # Switch back deliberately; unlike rollback, this is an independent
            # committed emergency restore of old routing semantics.
            cur.execute("begin")
            cur.execute(LEGACY_VIEW)
            cur.execute("commit")
            if view_origin(cur)!="legacy" or sample_results(cur,trip_ids)!=before:
                raise RuntimeError("Committed fallback to legacy failed")

            report={
                "ok":True,
                "environment":"disposable localhost PostgreSQL only",
                "source":"four-region core GTFS",
                "rows_compared":matched,
                "rows_changed":differences,
                "sample_trip_paths":len(trip_ids),
                "precommit_rollback":"PASS; original runtime view restored",
                "committed_compact_cutover":"PASS; same sample routes",
                "full_compatibility_view_rows":"PASS; all GTFS text and seconds matched",
                "emergency_legacy_fallback":"PASS; legacy view restored after commit",
                "full_compare_seconds":duration,
                "cutover_semantics":"transactional SQL view routing only; full production schema migration NOT rehearsed",
                "production_feasibility":"NOT APPROVED — database quota/WAL, production RPC changes, backup and restore still untested"
            }
            args.report.write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
            print("GTFS_CUTOVER_REHEARSAL_PASS",json.dumps(report,indent=2),flush=True)
    return 0

if __name__=="__main__":
    raise SystemExit(main())
