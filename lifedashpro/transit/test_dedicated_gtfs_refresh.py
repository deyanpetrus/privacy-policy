#!/usr/bin/env python3
"""Disposable Docker Postgres rolling GTFS refresh integration/rollback test."""
import csv
import os
import tempfile
from datetime import datetime,timedelta,timezone
from pathlib import Path
import psycopg

from dedicated_gtfs_import import FILES
from dedicated_gtfs_refresh import (refresh,status,should_refresh,SafePreflightError,
    verify_rpc_contracts,CORE_RPC_SIGNATURES,DEDICATED_RPC_SIGNATURES)

url=os.environ.get("DEDICATED_LOCAL_SMOKE_DB_URL","")
if not url.startswith("postgresql://ldp_gtfs_scratch:") or "@127.0.0.1:5432/ldp_gtfs_scratch" not in url:
    raise SystemExit("REFRESH TEST REFUSES REMOTE DATABASE")
today=datetime.now(timezone.utc).date()

# Exact approved signatures: four core in Docker, six in the live dedicated DB.
assert len(CORE_RPC_SIGNATURES)==4 and len(DEDICATED_RPC_SIGNATURES)==6
verify_rpc_contracts(CORE_RPC_SIGNATURES,4,local_fixture=True)
verify_rpc_contracts(DEDICATED_RPC_SIGNATURES,6)
for contracts,secure,fixture in (
    (CORE_RPC_SIGNATURES,4,False),        # remote missing two approved RPCs
    (DEDICATED_RPC_SIGNATURES,6,True),   # unexpected RPCs in local fixture
    (CORE_RPC_SIGNATURES,3,True),        # one core RPC lacks service grant
    (CORE_RPC_SIGNATURES+(CORE_RPC_SIGNATURES[0],),5,True), # overloaded RPC
):
    try:
        verify_rpc_contracts(contracts,secure,local_fixture=fixture)
    except SafePreflightError as exc:
        assert exc.code=="REFRESH_RPC_CONTRACT_OR_PERMISSIONS_FAILED"
    else:
        raise AssertionError("GTFS security guard accepted invalid RPC contract")

# Exercise the real pg_proc scan in LOCAL Docker PostgreSQL. ROLLBACK restores
# the fixture after each negative test; never connect to a cloud database.
with psycopg.connect(url,autocommit=False) as db:
    with db.cursor() as cur:
        cur.execute("create function public.transit_gtfs_unexpected() returns integer language sql as 'select 1'")
        try:
            status(cur,local_fixture=True)
        except SafePreflightError as exc:
            assert exc.code=="REFRESH_RPC_CONTRACT_OR_PERMISSIONS_FAILED"
        else:
            raise AssertionError("Unexpected public GTFS RPC was not rejected")
    db.rollback()
with psycopg.connect(url,autocommit=False) as db:
    with db.cursor() as cur:
        cur.execute("revoke execute on function public.transit_gtfs_nearby(double precision,double precision,integer,integer) from service_role")
        try:
            status(cur,local_fixture=True)
        except SafePreflightError as exc:
            assert exc.code=="REFRESH_RPC_CONTRACT_OR_PERMISSIONS_FAILED"
        else:
            raise AssertionError("Missing server-only RPC permission was not rejected")
    db.rollback()
print("DEDICATED_ROLLING_REFRESH_RPC_CONTRACT_GUARDS_PASS")

def record(key, **kwargs):
    row={k:None for k in FILES[key]}
    row["feed_source"]="de-national"
    row.update(kwargs)
    return row
with tempfile.TemporaryDirectory() as temporary:
    folder=Path(temporary)
    fixture={
      "stops":[record("stops",stop_id="s0",stop_name="Regensburg Hbf",stop_lat=49.0134,stop_lon=12.1016),
               record("stops",stop_id="s1",stop_name="New validated centre",stop_lat=49.014,stop_lon=12.102)],
      "routes":[record("routes",route_id="r1",route_short_name="Bus 1",route_type=3)],
      "trips":[record("trips",trip_id="t1",route_id="r1",service_id="w",trip_headsign="New validated centre")],
      "stop_times":[record("stop_times",trip_id="t1",stop_sequence=1,stop_id="s0",arrival_secs=90000,
                           departure_secs=90060,arrival_time="25:00:00",departure_time="25:01:00",
                           pickup_type=0,drop_off_type=0),
                    record("stop_times",trip_id="t1",stop_sequence=2,stop_id="s1",arrival_secs=90600,
                           departure_secs=90660,arrival_time="25:10:00",departure_time="25:11:00",
                           pickup_type=0,drop_off_type=0)],
      "calendar":[record("calendar",service_id="w",monday=True,tuesday=True,
                        wednesday=True,thursday=True,friday=True,saturday=True,sunday=True,
                        start_date=today.isoformat(),end_date=(today+timedelta(days=30)).isoformat())],
      "calendar_dates":[], "shapes":[]
    }
    for name,rows in fixture.items():
        with (folder/(name+".csv")).open("w",newline="",encoding="utf-8") as fh:
            csvwriter=csv.DictWriter(fh,fieldnames=FILES[name])
            csvwriter.writeheader()
            csvwriter.writerows(rows)
    counts={key:len(rows) for key,rows in fixture.items()}
    counts["shape_points"]=counts.pop("shapes")
    manifest={"feed_source":"de-national","feed_name":"New local GTFS fixture",
              "counts":counts,"selection":{"service_date":today.isoformat(),"service_days":7,
              "radius_km":6,"cities":[{"id":x} for x in ("regensburg","munich","nuremberg","nittendorf")]}}
    # Previous smoke imported old feed. Make its selection nearly expired in LOCAL DB only.
    with psycopg.connect(url,autocommit=True) as db:
        with db.cursor() as cur:
            old_state=status(cur,local_fixture=True)
            assert old_state["stop_times"]==2
            cur.execute("update transit_data.feeds set selected_from=%s,selected_until=%s,imported_at=%s where feed_source='de-national'",
                        (today-timedelta(days=14),today-timedelta(days=1),
                         datetime.now(timezone.utc)-timedelta(days=10)))
            cur.execute("select stop_name from transit_data.stops where stop_id='s1'")
            assert cur.fetchone()[0]=="City centre"
            assert should_refresh(status(cur,local_fixture=True),today)
    # Failure after TRUNCATE+import MUST rollback all old tables/metadata.
    with psycopg.connect(url,autocommit=False) as db:
        try:
            with db.cursor() as cur:
                refresh(cur,folder,manifest,force_failure=True,local_fixture=True)
            db.commit()
            raise AssertionError("Forced failure was not triggered")
        except SafePreflightError as exc:
            assert exc.code=="EXPECTED_TEST_ROLLBACK",exc.code
            db.rollback()
    with psycopg.connect(url,autocommit=True) as db:
        with db.cursor() as cur:
            state=status(cur,local_fixture=True)
            assert state["selected_until"]==today-timedelta(days=1),state
            assert state["stop_times"]==2
            cur.execute("select stop_name from transit_data.stops where stop_id='s1'")
            assert cur.fetchone()[0]=="City centre"
            print("DEDICATED_ROLLING_REFRESH_ROLLBACK_PASS")
    # Now refresh successfully, verifying midnight GTFS, stop labels and security.
    with psycopg.connect(url,autocommit=False) as db:
        with db.cursor() as cur:
            result=refresh(cur,folder,manifest,local_fixture=True)
        db.commit()
    with psycopg.connect(url,autocommit=True) as db:
        with db.cursor() as cur:
            state=status(cur,local_fixture=True)
            assert state["selected_until"]==today+timedelta(days=13)
            cur.execute("select stop_name from transit_data.stops where stop_id='s1'")
            assert cur.fetchone()[0]=="New validated centre"
            cur.execute("select public.transit_gtfs_trip_route('de-national','t1')")
            assert cur.fetchone()[0]["stops"][-1]["name"]=="New validated centre"
            assert state["stop_times"]==2 and state["db_bytes"]<450*1048576
            assert not should_refresh(state,today)
            print("DEDICATED_ROLLING_REFRESH_COMMIT_PASS",result["new_until"])
