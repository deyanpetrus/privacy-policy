#!/usr/bin/env python3
"""Read-only off-project GTFS snapshot + independent LOCAL PostgreSQL restore test.

Backs up ONLY the 8-table private transit_data schema of the NEW dedicated
Supabase project. NEVER backs up old LifeDashPro or NotesPro, never exposes
connection passwords or copies credentials into the resulting artifact.

Requires PostgreSQL 17 client in Docker. The archive may be uploaded to a
GitHub Actions artifact only AFTER a successful full restore/test on a new
disposable LOCAL PostgreSQL 17 database.
"""
from __future__ import annotations
import argparse
import json
import os
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlsplit
import psycopg

from dedicated_gtfs_import import verify_target, SafePreflightError, sanitized_error_code

SOURCE_VAR="LDP_DEDICATED_TRANSIT_DB_URL"
TARGET_REF="gnqtngtuzbxohgwgvmpb"
LOCAL_VAR="DEDICATED_LOCAL_SMOKE_DB_URL"
EXPECTED_TABLES={"feeds","stops","routes","trips","stop_times",
                 "calendar","calendar_dates","shapes"}
CONTAINER_IMAGE="postgres:17"
MIN_GTFS_ROWS=500000

def source_preflight(url):
    verify_target(url)
    with psycopg.connect(url,sslmode="require",connect_timeout=15,autocommit=True) as con:
        with con.cursor() as cur:
            cur.execute("""select current_database(),current_user,
                (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
                 where n.nspname='transit_data' and c.relkind='r' and c.relrowsecurity),
                (select count(*) from transit_data.feeds where active=true and feed_source='de-national'),
                (select count(*) from transit_data.stop_times),
                (select selected_until from transit_data.feeds where active=true and feed_source='de-national'),
                (select count(*) from pg_proc p join pg_namespace n on p.pronamespace=n.oid
                 where n.nspname='public' and p.proname like 'transit_gtfs_%'
                 and has_function_privilege('service_role',p.oid,'execute')
                 and not has_function_privilege('anon',p.oid,'execute')
                 and not has_function_privilege('authenticated',p.oid,'execute')),
                (select count(*) from pg_constraint fk join pg_class p on fk.confrelid=p.oid
                 join pg_namespace pn on p.relnamespace=pn.oid join pg_class c on fk.conrelid=c.oid
                 join pg_namespace cn on c.relnamespace=cn.oid where fk.contype='f'
                 and pn.nspname='transit_data' and cn.nspname!='transit_data'),
                pg_database_size(current_database()),current_setting('server_version_num')::integer""")
            db,role,rls,active,rows,until,rpcs,external_refs,db_bytes,version=cur.fetchone()
            if (db,role)!=("postgres","postgres") or rls!=8 or active!=1 or rows<MIN_GTFS_ROWS or rpcs!=4 or external_refs:
                raise SafePreflightError("SNAPSHOT_SOURCE_SECURITY_OR_CONTENT_INVALID")
            if version//10000 !=17:
                raise SafePreflightError("SNAPSHOT_PGDUMP17_SERVER_VERSION_MISMATCH")
            cur.execute("""select tablename from pg_tables where schemaname='transit_data'""")
            tables={x[0] for x in cur.fetchall()}
            if tables!=EXPECTED_TABLES:
                raise SafePreflightError("SNAPSHOT_UNEXPECTED_PRIVATE_TABLES")
            return {"stop_times":rows,"selected_until":str(until),
                    "db_mib":round(db_bytes/1048576,1),"tables":len(tables)}

def run_docker(args,uri=None):
    env=os.environ.copy()
    if uri is not None:
        env["PGURI"]=uri
    cmd=["docker","run","--rm","--network","host",
         "--env","PGURI","--volume",str(args[0])+":/snapshot:rw",
         CONTAINER_IMAGE]+args[1:]
    result=subprocess.run(cmd,env=env,stdout=subprocess.DEVNULL,
                          stderr=subprocess.DEVNULL,timeout=1500,check=False)
    if result.returncode:
        raise SafePreflightError("SNAPSHOT_DOCKER_PG_COMMAND_FAILED")

def create_archive(url,folder):
    folder.mkdir(parents=True,exist_ok=True)
    # URI exists only in PRIVATE process environment, never in argv, logs, or artifact.
    # Absolute trusted GitHub runner temp path is mounted, no arbitrary user path.
    run_docker([folder,"sh","-ec",
       'exec pg_dump --dbname "$PGURI" --format=custom --compress=6 '
       '--schema=transit_data --no-owner --no-acl --file=/snapshot/transit_data.pgdump'],url)
    archive=folder/"transit_data.pgdump"
    if not archive.exists() or archive.stat().st_size<100_000:
        raise SafePreflightError("SNAPSHOT_ARCHIVE_TOO_SMALL")
    return archive

def local_restore(archive,expected,*,local_fixture=False):
    local=os.environ.get(LOCAL_VAR,"")
    if (not local.startswith("postgresql://ldp_gtfs_scratch:") or
        "@127.0.0.1:5432/ldp_gtfs_scratch" not in local):
        raise SafePreflightError("SNAPSHOT_RESTORE_MUST_BE_LOCAL")
    restore=local.replace("/ldp_gtfs_scratch","/ldp_gtfs_restore",1)
    # Cannot accidentally connect to a cloud endpoint from LOCAL_URI.
    if urlsplit(restore).hostname!="127.0.0.1":
        raise SafePreflightError("SNAPSHOT_RESTORE_REMOTE_REJECTED")
    with psycopg.connect(local,autocommit=True) as con:
        with con.cursor() as cur:
            cur.execute("select current_database(),current_user")
            if cur.fetchone()!=("ldp_gtfs_scratch","ldp_gtfs_scratch"):
                raise SafePreflightError("SNAPSHOT_LOCAL_DB_ROLE_FAILED")
            cur.execute("create database ldp_gtfs_restore template template0")
    # PG17 client restores pg_dump custom archive to a NEW LOCAL Postgres DB.
    folder=archive.parent
    run_docker([folder,"sh","-ec",
       'exec pg_restore --dbname "$PGURI" --no-owner --no-acl '
       '--exit-on-error --single-transaction /snapshot/transit_data.pgdump'],restore)
    with psycopg.connect(restore,autocommit=True) as con:
        with con.cursor() as cur:
            cur.execute("select count(*) from transit_data.stop_times")
            rows=cur.fetchone()[0]
            cur.execute("select count(*) from transit_data.feeds where active and selected_until=%s",
                        (expected["selected_until"],))
            feed=cur.fetchone()[0]
            cur.execute("""select count(*) from pg_class c join pg_namespace n
                on n.oid=c.relnamespace where n.nspname='transit_data'
                and c.relkind='r' and c.relrowsecurity""")
            rls=cur.fetchone()[0]
            cur.execute("""select count(*) from transit_data.stop_times st
               left join transit_data.trips t on t.trip_key=st.trip_key
               left join transit_data.stops s on s.stop_key=st.stop_key
               where t.trip_key is null or s.stop_key is null""")
            dangling=cur.fetchone()[0]
            cur.execute("select count(*) from transit_data.stops")
            stops=cur.fetchone()[0]
            if rows!=expected["stop_times"] or feed!=1 or rls!=8 or dangling!=0 or stops<(2 if local_fixture else 5000):
                raise SafePreflightError("SNAPSHOT_RESTORED_COUNTS_OR_RLS_FAILED")
    return {"rows":rows,"feeds":feed,"rls_tables":rls,"dangling":dangling,"stops":stops}

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--confirm-project-ref",required=True)
    ap.add_argument("--output-dir",type=Path,required=True)
    args=ap.parse_args()
    if args.confirm_project_ref!=TARGET_REF:
        raise SafePreflightError("SNAPSHOT_WRONG_PROJECT_REF")
    if os.environ.get("LDP_TRANSIT_DB_URL"):
        raise SafePreflightError("SNAPSHOT_OLD_PRODUCTION_SECRET_PRESENT")
    url=os.environ.get(SOURCE_VAR,"")
    before=source_preflight(url)
    archive=create_archive(url,args.output_dir.resolve())
    restored=local_restore(archive,before)
    receipt={"database":"NEW dedicated Transit only",
             "snapshot_file":archive.name,
             "archive_mebibytes":round(archive.stat().st_size/1048576,1),
             "original":before,"restored":restored,
             "restore_test":"PASS"}
    # Receipt has no credentials, tokens, user records or DB URL.
    (args.output_dir/"receipt.json").write_text(json.dumps(receipt,indent=2)+"\n",encoding="utf-8")
    print("DEDICATED_GTFS_OFFSITE_SNAPSHOT_RESTORE_PASS",json.dumps(receipt),flush=True)
    return 0

if __name__=="__main__":
    try:
        raise SystemExit(main())
    except Exception as e:
        print("DEDICATED_GTFS_SNAPSHOT_FAILED: "+sanitized_error_code(e,"import")+
              " (no connection details logged)",file=sys.stderr)
        raise SystemExit(1) from None
