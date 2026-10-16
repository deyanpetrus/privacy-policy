#!/usr/bin/env python3
"""Validate a Germany GTFS subset before any feed-scoped database replacement.

No secrets are printed. A publish requires a configured database storage quota;
on a small Supabase database this stops full replacement if it might exceed disk.
"""
import argparse
import csv
import json
import os
import sys
from datetime import date, timedelta
from pathlib import Path

REQUIRED = ("stops", "routes", "trips", "stop_times", "calendar", "calendar_dates", "shape_points")

def manifest_check(root: Path, min_days: int, min_zip_mb: int, profile: str):
    obj = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    if obj.get("feed_source") != "de-national":
        raise RuntimeError("Safety stop: unexpected feed source (only de-national permitted)")
    c = obj.get("counts", {})
    for key in REQUIRED:
        if not isinstance(c.get(key), int) or c[key] < 0:
            raise RuntimeError("Safety stop: missing or invalid manifest count " + key)
    if min_zip_mb and (obj.get("source_zip_bytes") or 0) < min_zip_mb * 1024 * 1024:
        raise RuntimeError("Safety stop: GTFS source ZIP unexpectedly small")
    if profile == "pilot":
        # Read-only smoke test: two cities, NEVER eligible for database replacement.
        allowed = {"regensburg", "nuremberg"}
        selected = {str(c.get("id", "")) for c in obj.get("selection", {}).get("cities", [])}
        if selected != allowed:
            raise RuntimeError("Safety stop: pilot must contain Regensburg and Nürnberg only")
        if c["stops"] < 1000 or c["routes"] < 20 or c["trips"] < 1000 or c["stop_times"] < 20000:
            raise RuntimeError("Safety stop: GTFS pilot sample unexpectedly small")
        required_cities = ("regensburg", "nuremberg")
    elif profile == "production":
        if c["stops"] < 4_000 or c["routes"] < 150 or c["trips"] < 10_000 or c["stop_times"] < 250_000:
            raise RuntimeError("Safety stop: Germany data subset too small for production")
        required_cities = ("regensburg", "munich", "nuremberg", "berlin", "hamburg", "cologne", "frankfurt", "dresden")
    else:
        raise RuntimeError("Unknown validation profile")
    cities = obj.get("city_seed_stop_counts", {})
    for city in required_cities:
        if int(cities.get(city) or 0) < 30:
            raise RuntimeError("Safety stop: insufficient GTFS stops in " + city)
    sel = obj["selection"]
    start = date.fromisoformat(sel["service_date"])
    window_days = int(sel["service_days"])
    if window_days < min_days + 1 or window_days > 31:
        raise RuntimeError("Safety stop: service-day window is too short or too long")
    if abs((date.today() - start).days) > 2:
        raise RuntimeError("Safety stop: subset was generated for an outdated date")
    wanted_end = start + timedelta(days=min_days)
    latest = None
    for filename, col in (("calendar.csv", "end_date"), ("calendar_dates.csv", "service_date")):
        with (root / filename).open(newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                val = (row.get(col) or "").strip()
                if val:
                    d = date.fromisoformat(val)
                    if latest is None or d > latest:
                        latest = d
    if latest is None or latest < wanted_end:
        raise RuntimeError("Safety stop: fresh GTFS does not cover at least " + str(min_days) + " days")
    for key in ("stops", "routes", "trips", "stop_times", "calendar", "calendar_dates", "shapes"):
        p = root / (key + ".csv")
        if not p.is_file() or p.stat().st_size < 2:
            raise RuntimeError("Safety stop: required CSV missing or empty: " + str(p))
    print(json.dumps({"preflight": "PASS", "profile": profile, "feed": "de-national",
        "source_zip_bytes": obj.get("source_zip_bytes"), "counts": c,
        "service_start": str(start), "service_end": str(latest)}, indent=2))
    return obj

def database_check(obj: dict, limit_mb: int):
    if limit_mb < 500:
        raise RuntimeError("Safety stop: confirm the Supabase database quota (minimum 500 MB)")
    url = os.environ.get("LDP_TRANSIT_DB_URL", "").strip()
    if not url:
        raise RuntimeError("Missing GitHub Actions Secret LDP_TRANSIT_DB_URL")
    import psycopg
    with psycopg.connect(url, autocommit=True, connect_timeout=20) as con:
        with con.cursor() as cur:
            cur.execute("select pg_database_size(current_database())")
            db_bytes = int(cur.fetchone()[0])
            cur.execute("""select coalesce(sum(pg_total_relation_size(
                  format('%I.%I', schemaname, tablename)::regclass)),0)
                  from pg_tables where schemaname='public' and tablename like 'transit_gtfs_%'""")
            gtfs_bytes = int(cur.fetchone()[0])
            cur.execute("select feed_source from public.transit_gtfs_feeds where feed_source='de-national'")
            if not cur.fetchone():
                raise RuntimeError("Safety stop: expected de-national namespace not found")
            observed = {}
            for table, key in (("stops","stops"),("routes","routes"),("trips","trips"),
                               ("stop_times","stop_times")):
                cur.execute("select count(*) from public.transit_gtfs_" + table + " where feed_source=%s", ("de-national",))
                count = int(cur.fetchone()[0])
                observed[key] = count
                if count and obj["counts"][key] < count * 0.55:
                    raise RuntimeError("Safety stop: new " + key + " drops below 55% of existing")
            # DELETE + INSERT is transactional, but old and new rows coexist until
            # COMMIT/VACUUM. Include a 25% margin for new table/index/WAL growth.
            ratio = max(1.0, obj["counts"]["stop_times"] / max(1, observed["stop_times"]))
            estimated_peak = db_bytes + int(gtfs_bytes * ratio * 1.25)
            hard_limit = limit_mb * 1024 * 1024
            if estimated_peak >= hard_limit * 0.85:
                raise RuntimeError(
                    "Safety stop: estimated import may exceed storage. Current DB " +
                    str(round(db_bytes / 1048576)) + "MB; estimated peak " +
                    str(round(estimated_peak / 1048576)) + "MB; configured quota " + str(limit_mb) + "MB")
            print(json.dumps({"database_preflight":"PASS", "quota_mb":limit_mb,
                "current_database_mb":round(db_bytes/1048576),
                "estimated_peak_mb":round(estimated_peak/1048576), "previous":observed},indent=2))

if __name__ == "__main__":
    ap=argparse.ArgumentParser()
    ap.add_argument("--dir",required=True,type=Path)
    ap.add_argument("--min-valid-days",type=int,default=12)
    ap.add_argument("--min-zip-mb",type=int,default=100)
    ap.add_argument("--profile", choices=("pilot", "production"), default="production",
                    help="pilot is a read-only two-city validation; production is nine-city import gate")
    ap.add_argument("--check-database",action="store_true")
    ap.add_argument("--database-limit-mb",type=int,default=0)
    args=ap.parse_args()
    try:
        if args.check_database and args.profile != "production":
            raise RuntimeError("Safety stop: pilot profile may not connect to or modify Supabase")
        m=manifest_check(args.dir,args.min_valid_days,args.min_zip_mb,args.profile)
        if args.check_database: database_check(m,args.database_limit_mb)
    except Exception as e:
        print(str(e),file=sys.stderr)
        sys.exit(1)
