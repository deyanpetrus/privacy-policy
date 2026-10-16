#!/usr/bin/env python3
"""Offline test of dedicated importer transformations; disposable PostgreSQL only."""
import csv
import json
import os
import tempfile
from datetime import datetime,timezone
from pathlib import Path
import psycopg
from dedicated_gtfs_import import FILES,run_import,require_empty

URL=os.environ.get("DEDICATED_LOCAL_SMOKE_DB_URL","")
if not URL.startswith("postgresql://ldp_gtfs_scratch:") or "@127.0.0.1:5432/ldp_gtfs_scratch" not in URL:
    raise RuntimeError("SMOKE TEST REFUSES NON-LOCAL DATABASE")
SCHEMA=Path(__file__).with_name("dedicated_schema.sql")
today=datetime.now(timezone.utc).date().isoformat()

def write(folder,name,records):
    with (folder/(name+".csv")).open("w",encoding="utf-8",newline="") as f:
        writer=csv.DictWriter(f,fieldnames=FILES[name])
        writer.writeheader()
        writer.writerows(records)

def record(name,**kwargs):
    d={c:None for c in FILES[name]}
    d["feed_source"]="de-national"
    d.update(kwargs)
    return d

with tempfile.TemporaryDirectory() as dir_name:
    folder=Path(dir_name)
    fixture={
      "stops":[record("stops",stop_id="s0",stop_name="Regensburg Hbf",stop_lat=49.0134,stop_lon=12.1016),
               record("stops",stop_id="s1",stop_name="City centre",stop_lat=49.014,stop_lon=12.102)],
      "routes":[record("routes",route_id="r1",route_short_name="Bus 1",route_type=3)],
      "trips":[record("trips",trip_id="t1",route_id="r1",service_id="w",trip_headsign="City centre")],
      "stop_times":[record("stop_times",trip_id="t1",stop_sequence=1,stop_id="s0",arrival_secs=90000,
                           departure_secs=90060,arrival_time="25:00:00",departure_time="25:01:00",
                           pickup_type=0,drop_off_type=0),
                    record("stop_times",trip_id="t1",stop_sequence=2,stop_id="s1",arrival_secs=90600,
                           departure_secs=90660,arrival_time="25:10:00",departure_time="25:11:00",
                           pickup_type=0,drop_off_type=0)],
      "calendar":[record("calendar",service_id="w",monday=True,tuesday=True,
                        wednesday=True,thursday=True,friday=True,saturday=True,sunday=True,
                        start_date=today,end_date=today)],
      "calendar_dates":[],
      "shapes":[]
    }
    for table, rows in fixture.items():
        write(folder,table,rows)
    counts={k:len(v) for k,v in fixture.items()}
    counts["shape_points"]=counts.pop("shapes")
    manifest={"feed_source":"de-national","feed_name":"Test fixture","counts":counts,
              "selection":{"service_date":today,"service_days":7,"radius_km":6,
                 "cities":[{"id":x} for x in ("regensburg","munich","nuremberg","nittendorf")]}}
    with psycopg.connect(URL,autocommit=True) as conn:
        with conn.cursor() as c:
            c.execute("select current_database(),current_user,inet_server_addr()")
            db,user,host=c.fetchone()
            if (db,user)!=("ldp_gtfs_scratch","ldp_gtfs_scratch"):
                raise RuntimeError("Safety: wrong smoke-test user/database")
            c.execute("create role anon noinherit nologin")
            c.execute("create role authenticated noinherit nologin")
            c.execute(SCHEMA.read_text(encoding="utf-8"))
            require_empty(c)
            report=run_import(c,folder,manifest)
            assert report["active"] is True,report
            c.execute("select f.active,count(st.*),min(st.departure_secs),max(st.departure_secs) "+
                      "from transit_data.feeds f "+
                      "join transit_data.stops s on s.feed_source=f.feed_source "+
                      "join transit_data.stop_times st on st.stop_key=s.stop_key "+
                      "group by f.active")
            active,n,lo,hi=c.fetchone()
            assert (active,n,lo,hi)==(True,2,90060,90660), (active,n,lo,hi)
            c.execute("select has_schema_privilege('anon','transit_data','USAGE'),"+
                      "has_schema_privilege('authenticated','transit_data','USAGE')")
            assert c.fetchone()==(False,False)
            try:
                require_empty(c)
            except RuntimeError:
                pass
            else:
                raise RuntimeError("Importer must refuse any repeat/nonempty database")
            print("DEDICATED_GTFS_IMPORT_SMOKE_PASS: numeric keys, 24h+ times, RLS, immutable destination",flush=True)
