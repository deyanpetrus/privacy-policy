#!/usr/bin/env python3
"""Read-only parity/security tests against disposable LOCAL dedicated GTFS DB."""
import os
from datetime import datetime,timedelta,timezone
import psycopg
uri=os.environ.get("DEDICATED_LOCAL_SMOKE_DB_URL","")
if not uri.startswith("postgresql://ldp_gtfs_scratch:") or "@127.0.0.1:5432/ldp_gtfs_scratch" not in uri:
    raise SystemExit("Refusing non-local RPC smoke test")
today=datetime.now(timezone.utc).date()
with psycopg.connect(uri,autocommit=True) as db:
    with db.cursor() as cur:
        cur.execute("select current_user,current_database()")
        assert cur.fetchone()==("ldp_gtfs_scratch","ldp_gtfs_scratch")
        cur.execute("select feed_source,stops,routes,trips,stop_times from public.transit_gtfs_cache_status()")
        assert cur.fetchone()==("de-national",2,1,1,2), "cache status mismatch"
        cur.execute("select stop_id,distance_m from public.transit_gtfs_nearby(49.0134,12.1016,1800,10)")
        near=cur.fetchall()
        assert near[0][0]=="s0" and near[0][1]==0 and len(near)==2,near
        cur.execute("select transit_data.service_active(%s,%s,%s)",("de-national","w",today))
        assert cur.fetchone()[0] is True
        cur.execute("select count(*),min(departure_time),min(display_seconds) from public.transit_gtfs_departures(%s,%s,%s,%s,%s,%s)",
                    ("de-national","s0",today,82800,180,50))
        n,gtfs_clock,seconds=cur.fetchone()
        assert (n,gtfs_clock,seconds)==(1,"25:01:00",90060),(n,gtfs_clock,seconds)
        # At 00:00 on the next calendar day, show the previous GTFS service's 25:01 trip.
        cur.execute("select count(*),min(display_seconds) from public.transit_gtfs_departures(%s,%s,%s,%s,%s,%s)",
                    ("de-national","s0",today+timedelta(days=1),0,180,50))
        n,seconds=cur.fetchone()
        assert (n,seconds)==(1,3660),(n,seconds)
        cur.execute("select public.transit_gtfs_trip_route('de-national','t1')")
        trip=cur.fetchone()[0]
        assert trip["tripId"]=="t1" and trip["geometryKind"]=="stops"
        assert trip["approximate"] is True
        assert len(trip["stops"])==2 and len(trip["points"])==2
        assert trip["stops"][0]["departureTime"]=="25:01:00"
        cur.execute("""select proname,
                    has_function_privilege('anon',p.oid,'execute'),
                    has_function_privilege('authenticated',p.oid,'execute'),
                    has_function_privilege('service_role',p.oid,'execute')
                    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                    where n.nspname='public' and proname like 'transit_gtfs_%'""")
        rows=cur.fetchall()
        assert len(rows)==4,rows
        for name,anon,authenticated,service in rows:
            assert (anon,authenticated,service)==(False,False,True), (name,anon,authenticated,service)
        print("DEDICATED_GTFS_RPC_CONTRACT_PASS (4 server-only RPCs, nearby, departure, midnight, trip, status)")
