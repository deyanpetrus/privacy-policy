#!/usr/bin/env python3
"""LifeDashPro v37.83 — selective Germany national GTFS extractor.

Reads the large gtfs.de nv_free ZIP in streaming passes and writes a compact,
feed-safe CSV subset for the Germany test matrix. It never writes to Supabase.

Selection model:
- seed stops within --radius-km of any configured city
- trips touching seed stops
- only trips whose service_id is active at least once in --service-days from --service-date
- all stop_times for those selected trips (preserves approximate trip path)
- all referenced stops/routes/services

This is intentionally a validation/extraction step before remote import.
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import math
import os
import sys
import zipfile
from collections import defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path

FEED_SOURCE = "de-national"
FEED_NAME = "Germany national local transit (gtfs.de nv_free)"

CITIES = [
    {"id": "regensburg", "name": "Regensburg", "lat": 49.0134, "lon": 12.1016},
    {"id": "munich", "name": "Munich", "lat": 48.1374, "lon": 11.5755},
    {"id": "nuremberg", "name": "Nürnberg", "lat": 49.4521, "lon": 11.0767},
    {"id": "berlin", "name": "Berlin", "lat": 52.5200, "lon": 13.4050},
    {"id": "hamburg", "name": "Hamburg", "lat": 53.5511, "lon": 9.9937},
    {"id": "cologne", "name": "Köln", "lat": 50.9375, "lon": 6.9603},
    {"id": "frankfurt", "name": "Frankfurt am Main", "lat": 50.1109, "lon": 8.6821},
    {"id": "dresden", "name": "Dresden", "lat": 51.0504, "lon": 13.7373},
    {"id": "nittendorf", "name": "Nittendorf", "lat": 49.0240, "lon": 11.9610},
]

REQUIRED = {"stops.txt", "routes.txt", "trips.txt", "stop_times.txt"}


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0088
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def parse_gtfs_date(v: str) -> date | None:
    v = (v or "").strip()
    if not v:
        return None
    try:
        return datetime.strptime(v, "%Y%m%d").date()
    except ValueError:
        return None


def gtfs_time_to_secs(v: str) -> int | None:
    v = (v or "").strip()
    if not v:
        return None
    try:
        h, m, s = [int(x) for x in v.split(":")]
        if m < 0 or m > 59 or s < 0 or s > 59 or h < 0:
            return None
        return h * 3600 + m * 60 + s
    except Exception:
        return None


def iter_dict_rows(zf: zipfile.ZipFile, member: str):
    with zf.open(member, "r") as raw:
        text = io.TextIOWrapper(raw, encoding="utf-8-sig", newline="")
        yield from csv.DictReader(text)


def active_services(zf: zipfile.ZipFile, start: date, days: int) -> tuple[set[str], dict[str, set[date]]]:
    dates = [start + timedelta(days=i) for i in range(days)]
    active_by_date: dict[date, set[str]] = {d: set() for d in dates}

    if "calendar.txt" in zf.namelist():
        for row in iter_dict_rows(zf, "calendar.txt"):
            sid = (row.get("service_id") or "").strip()
            sd, ed = parse_gtfs_date(row.get("start_date", "")), parse_gtfs_date(row.get("end_date", ""))
            if not sid or not sd or not ed:
                continue
            flags = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
            for d in dates:
                if sd <= d <= ed and (row.get(flags[d.weekday()]) or "0").strip() == "1":
                    active_by_date[d].add(sid)

    if "calendar_dates.txt" in zf.namelist():
        for row in iter_dict_rows(zf, "calendar_dates.txt"):
            sid = (row.get("service_id") or "").strip()
            d = parse_gtfs_date(row.get("date", ""))
            if not sid or d not in active_by_date:
                continue
            typ = (row.get("exception_type") or "").strip()
            if typ == "1":
                active_by_date[d].add(sid)
            elif typ == "2":
                active_by_date[d].discard(sid)

    union = set().union(*active_by_date.values()) if active_by_date else set()
    inverse: dict[str, set[date]] = defaultdict(set)
    for d, ids in active_by_date.items():
        for sid in ids:
            inverse[sid].add(d)
    return union, inverse


def write_csv(path: Path, fields: list[str], rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        count = 0
        for row in rows:
            w.writerow({k: "" if row.get(k) is None else row.get(k) for k in fields})
            count += 1
    return count


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--zip", required=True)
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--radius-km", type=float, default=12.0)
    ap.add_argument("--service-date", default=date.today().isoformat(), help="YYYY-MM-DD")
    ap.add_argument("--service-days", type=int, default=7)
    ap.add_argument("--max-trips", type=int, default=250000, help="Safety stop; 0 disables")
    ap.add_argument("--city-ids", default="", help="Comma-separated subset of city ids; default is all configured cities")
    args = ap.parse_args()

    src = Path(args.zip)
    out = Path(args.out_dir)
    if not src.exists():
        raise SystemExit(f"ZIP not found: {src}")
    start = date.fromisoformat(args.service_date)
    if args.radius_km <= 0 or args.radius_km > 100:
        raise SystemExit("--radius-km must be >0 and <=100")
    if args.service_days < 1 or args.service_days > 31:
        raise SystemExit("--service-days must be 1..31")

    selected_cities = CITIES
    if args.city_ids.strip():
        wanted = {x.strip().lower() for x in args.city_ids.split(",") if x.strip()}
        known = {c["id"] for c in CITIES}
        unknown = sorted(wanted - known)
        if unknown:
            raise SystemExit(f"Unknown --city-ids: {unknown}. Known: {sorted(known)}")
        selected_cities = [c for c in CITIES if c["id"] in wanted]
        if not selected_cities:
            raise SystemExit("--city-ids selected no cities")

    out.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(src) as zf:
        names = set(zf.namelist())
        missing = sorted(REQUIRED - names)
        if missing:
            raise SystemExit(f"Missing required GTFS files: {missing}")

        print(f"[1/7] Resolving services active {start} +{args.service_days-1} days ...", flush=True)
        active_ids, active_dates = active_services(zf, start, args.service_days)
        print(f"      active service_ids: {len(active_ids):,}", flush=True)
        if not active_ids:
            raise SystemExit("Safety stop: source has no active GTFS services for the requested date window.")


        print(f"[2/7] Selecting seed stops within {args.radius_km:g} km of {len(selected_cities)} test places ...", flush=True)
        seed_stop_ids: set[str] = set()
        seed_city_hits: dict[str, list[str]] = defaultdict(list)
        seed_rows: dict[str, dict] = {}
        parent_ids: set[str] = set()
        for row in iter_dict_rows(zf, "stops.txt"):
            sid = (row.get("stop_id") or "").strip()
            try:
                lat, lon = float(row.get("stop_lat", "")), float(row.get("stop_lon", ""))
            except Exception:
                continue
            hits = []
            for c in selected_cities:
                if haversine_km(lat, lon, c["lat"], c["lon"]) <= args.radius_km:
                    hits.append(c["id"])
            if hits:
                seed_stop_ids.add(sid)
                seed_rows[sid] = row
                p = (row.get("parent_station") or "").strip()
                if p:
                    parent_ids.add(p)
                for cid in hits:
                    seed_city_hits[cid].append(sid)
        print(f"      seed stops: {len(seed_stop_ids):,}", flush=True)
        for c in selected_cities:
            print(f"      {c['name']}: {len(seed_city_hits[c['id']]):,}", flush=True)

        print("[3/7] Pass 1 over stop_times.txt: trips touching seed stops ...", flush=True)
        candidate_trips: set[str] = set()
        scanned = 0
        for row in iter_dict_rows(zf, "stop_times.txt"):
            scanned += 1
            if (row.get("stop_id") or "").strip() in seed_stop_ids:
                tid = (row.get("trip_id") or "").strip()
                if tid:
                    candidate_trips.add(tid)
            if scanned % 5_000_000 == 0:
                print(f"      scanned {scanned:,}; candidate trips {len(candidate_trips):,}", flush=True)
        print(f"      scanned {scanned:,}; candidate trips {len(candidate_trips):,}", flush=True)

        print("[4/7] Filtering candidate trips by active service window and collecting routes ...", flush=True)
        selected_trips: dict[str, dict] = {}
        route_ids: set[str] = set()
        selected_service_ids: set[str] = set()
        for row in iter_dict_rows(zf, "trips.txt"):
            tid = (row.get("trip_id") or "").strip()
            if tid not in candidate_trips:
                continue
            sid = (row.get("service_id") or "").strip()
            if active_ids and sid not in active_ids:
                continue
            selected_trips[tid] = row
            route_ids.add((row.get("route_id") or "").strip())
            selected_service_ids.add(sid)
            if args.max_trips and len(selected_trips) > args.max_trips:
                raise SystemExit(
                    f"Safety stop: selected trips exceeded --max-trips={args.max_trips:,}. "
                    "Use a smaller radius/service window or explicitly raise the cap."
                )
        print(f"      selected active trips: {len(selected_trips):,}; routes: {len(route_ids):,}", flush=True)

        # routes
        route_rows = []
        for row in iter_dict_rows(zf, "routes.txt"):
            if (row.get("route_id") or "").strip() in route_ids:
                route_rows.append({
                    "feed_source": FEED_SOURCE,
                    "route_id": row.get("route_id", ""),
                    "agency_id": row.get("agency_id", ""),
                    "route_short_name": row.get("route_short_name", ""),
                    "route_long_name": row.get("route_long_name", ""),
                    "route_type": row.get("route_type", ""),
                    "route_color": row.get("route_color", ""),
                    "route_text_color": row.get("route_text_color", ""),
                })

        print("[5/7] Pass 2 over stop_times.txt: preserving full selected trip stop paths ...", flush=True)
        stop_times_path = out / "stop_times.csv"
        stop_ids_needed: set[str] = set(seed_stop_ids) | parent_ids
        st_fields = ["feed_source","trip_id","stop_sequence","stop_id","arrival_time","departure_time","arrival_secs","departure_secs","stop_headsign","pickup_type","drop_off_type"]
        st_count = 0
        with stop_times_path.open("w", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=st_fields)
            w.writeheader()
            scanned2 = 0
            for row in iter_dict_rows(zf, "stop_times.txt"):
                scanned2 += 1
                tid = (row.get("trip_id") or "").strip()
                if tid not in selected_trips:
                    continue
                sid = (row.get("stop_id") or "").strip()
                stop_ids_needed.add(sid)
                w.writerow({
                    "feed_source": FEED_SOURCE,
                    "trip_id": tid,
                    "stop_sequence": row.get("stop_sequence", ""),
                    "stop_id": sid,
                    "arrival_time": row.get("arrival_time", ""),
                    "departure_time": row.get("departure_time", ""),
                    "arrival_secs": gtfs_time_to_secs(row.get("arrival_time", "")),
                    "departure_secs": gtfs_time_to_secs(row.get("departure_time", "")),
                    "stop_headsign": row.get("stop_headsign", ""),
                    "pickup_type": row.get("pickup_type", ""),
                    "drop_off_type": row.get("drop_off_type", ""),
                })
                st_count += 1
                if scanned2 % 5_000_000 == 0:
                    print(f"      scanned {scanned2:,}; kept stop_times {st_count:,}", flush=True)
        print(f"      kept stop_times: {st_count:,}; referenced stops: {len(stop_ids_needed):,}", flush=True)

        print("[6/7] Writing compact feed-safe CSVs ...", flush=True)
        stop_fields = ["feed_source","stop_id","stop_name","stop_code","parent_station","platform_code","stop_lat","stop_lon"]
        stop_path = out / "stops.csv"
        stop_count = 0
        with stop_path.open("w", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=stop_fields)
            w.writeheader()
            for row in iter_dict_rows(zf, "stops.txt"):
                sid = (row.get("stop_id") or "").strip()
                if sid not in stop_ids_needed:
                    continue
                w.writerow({
                    "feed_source": FEED_SOURCE,
                    "stop_id": sid,
                    "stop_name": row.get("stop_name", ""),
                    "stop_code": row.get("stop_code", ""),
                    "parent_station": row.get("parent_station", ""),
                    "platform_code": row.get("platform_code", ""),
                    "stop_lat": row.get("stop_lat", ""),
                    "stop_lon": row.get("stop_lon", ""),
                })
                stop_count += 1

        route_count = write_csv(out / "routes.csv", ["feed_source","route_id","agency_id","route_short_name","route_long_name","route_type","route_color","route_text_color"], route_rows)
        trip_count = write_csv(out / "trips.csv", ["feed_source","trip_id","route_id","service_id","trip_headsign","trip_short_name","direction_id","shape_id"], (
            {
                "feed_source": FEED_SOURCE,
                "trip_id": tid,
                "route_id": row.get("route_id", ""),
                "service_id": row.get("service_id", ""),
                "trip_headsign": row.get("trip_headsign", ""),
                "trip_short_name": row.get("trip_short_name", ""),
                "direction_id": row.get("direction_id", ""),
                "shape_id": "",  # national nv_free currently has no raw shapes
            }
            for tid, row in selected_trips.items()
        ))

        cal_count = 0
        if "calendar.txt" in names:
            cal_count = write_csv(out / "calendar.csv", ["feed_source","service_id","monday","tuesday","wednesday","thursday","friday","saturday","sunday","start_date","end_date"], (
                {
                    "feed_source": FEED_SOURCE,
                    "service_id": row.get("service_id", ""),
                    "monday": (row.get("monday") or "0") == "1",
                    "tuesday": (row.get("tuesday") or "0") == "1",
                    "wednesday": (row.get("wednesday") or "0") == "1",
                    "thursday": (row.get("thursday") or "0") == "1",
                    "friday": (row.get("friday") or "0") == "1",
                    "saturday": (row.get("saturday") or "0") == "1",
                    "sunday": (row.get("sunday") or "0") == "1",
                    "start_date": (lambda d: d.isoformat() if d else "")(parse_gtfs_date(row.get("start_date", ""))),
                    "end_date": (lambda d: d.isoformat() if d else "")(parse_gtfs_date(row.get("end_date", ""))),
                }
                for row in iter_dict_rows(zf, "calendar.txt")
                if (row.get("service_id") or "").strip() in selected_service_ids
            ))
        else:
            write_csv(out / "calendar.csv", ["feed_source","service_id","monday","tuesday","wednesday","thursday","friday","saturday","sunday","start_date","end_date"], [])

        cald_count = 0
        if "calendar_dates.txt" in names:
            cald_count = write_csv(out / "calendar_dates.csv", ["feed_source","service_id","service_date","exception_type"], (
                {
                    "feed_source": FEED_SOURCE,
                    "service_id": row.get("service_id", ""),
                    "service_date": (lambda d: d.isoformat() if d else "")(parse_gtfs_date(row.get("date", ""))),
                    "exception_type": row.get("exception_type", ""),
                }
                for row in iter_dict_rows(zf, "calendar_dates.txt")
                if (row.get("service_id") or "").strip() in selected_service_ids
            ))
        else:
            write_csv(out / "calendar_dates.csv", ["feed_source","service_id","service_date","exception_type"], [])

        # No raw shapes for this feed version; keep an explicit empty CSV.
        write_csv(out / "shapes.csv", ["feed_source","shape_id","shape_pt_sequence","shape_pt_lat","shape_pt_lon","shape_dist_traveled"], [])

        print("[7/7] Writing manifest ...", flush=True)
        files = {}
        for p in sorted(out.glob("*.csv")):
            files[p.name] = {"bytes": p.stat().st_size}
        manifest = {
            "feed_source": FEED_SOURCE,
            "feed_name": FEED_NAME,
            "source_zip": str(src.resolve()),
            "source_zip_bytes": src.stat().st_size,
            "selection": {
                "radius_km": args.radius_km,
                "service_date": start.isoformat(),
                "service_days": args.service_days,
                "cities": selected_cities,
            },
            "geometry": {"exact_shape_capable": False, "geometry_selection": "stops", "approximate": True},
            "counts": {
                "seed_stops": len(seed_stop_ids),
                "stops": stop_count,
                "routes": route_count,
                "trips": trip_count,
                "stop_times": st_count,
                "calendar": cal_count,
                "calendar_dates": cald_count,
                "shape_points": 0,
            },
            "city_seed_stop_counts": {c["id"]: len(seed_city_hits[c["id"]]) for c in selected_cities},
            "files": files,
        }
        (out / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
        print(json.dumps(manifest, indent=2, ensure_ascii=False), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())