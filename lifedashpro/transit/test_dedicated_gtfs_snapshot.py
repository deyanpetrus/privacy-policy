#!/usr/bin/env python3
"""Offline restore round-trip of a disposable TWO-stop GTFS fixture."""
import os
import tempfile
from pathlib import Path
from datetime import date
import psycopg
from dedicated_gtfs_snapshot import create_archive,local_restore

url=os.environ.get("DEDICATED_LOCAL_SMOKE_DB_URL","")
if not url.startswith("postgresql://ldp_gtfs_scratch:") or "@127.0.0.1:5432/ldp_gtfs_scratch" not in url:
    raise SystemExit("DO NOT CONNECT TO REAL DATABASE IN BACKUP TEST")
with psycopg.connect(url,autocommit=True) as db:
    with db.cursor() as cur:
        cur.execute("select count(*) from transit_data.stop_times")
        assert cur.fetchone()[0]==2
        cur.execute("select selected_until from transit_data.feeds where feed_source='de-national' and active")
        until=str(cur.fetchone()[0])
with tempfile.TemporaryDirectory() as root:
    archive=create_archive(url,Path(root))
    assert archive.is_file() and archive.stat().st_size>1000
    result=local_restore(archive,{"selected_until":until,"stop_times":2},local_fixture=True)
    assert result["rows"]==2 and result["rls_tables"]==8 and result["dangling"]==0
    print("DEDICATED_GTFS_BACKUP_RESTORE_LOCAL_ROUNDTRIP_PASS")
