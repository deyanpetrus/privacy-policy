# LifeDashPro NEXT — Germany GTFS coverage expansion v5
**15 November 2026 — IMPLEMENTED (server-side), device confirmation pending.**

## What we learned from reading the real official Germany GTFS
Read-only nationwide GTFS.de NV scan [SUCCESS #43703182435](https://github.com/deyanpetrus/privacy-policy/actions/runs/43703182435) streamed a 253.87 MiB compressed ZIP (35,247,149 `stop_times` rows) on a temporary GitHub runner. We selected routes with published active GTFS services in the 7-day window. **No national data was imported in this audit.**

| City (6km) | Active bus stops in this source | Bus routes |
|---|---:|---:|
| Regensburg | 767 | 101 |
| Neustadt an der Donau | 70 | 20 |
| Pfaffenhofen an der Ilm (Bavaria) | 158 | 16 |
| Pfaffenhofen an der Zaber (Baden-Württemberg) | 93 | 10 |
| Bremen | 530 | 115 |
| Hamburg | 1,089 | 147 |
| Berlin | 1,371 | 149 |
| Stuttgart | 651 | 73 |
| Cologne | 650 | 61 |
| Frankfurt am Main | 658 | 145 |
| Dresden | 687 | 99 |
| Leipzig | 769 | 81 |

**Interpretation:** Germany-wide scheduled public transport already exists in the GTFS.de source; missing results in NEXT typically reflect the **selected geographic database subset, online API coverage, or client mapping**. This is not a claim that every national operator or every realtime service is present. Counts are from the source, not from Supabase/Android. For the station-specific audit, rail `rv_free` is distinct from `nv_free`, so no rail completeness claim is implied.

## New isolated private cache shipped in NEXT

- Added `transit_next.de_regional_bus_meta`, A/B `de_regional_bus_stops_a/b`, `de_regional_bus_departures_a/b`, with **RLS enabled and no anon/authenticated access**. Both RPCs are service-role-only, `SECURITY INVOKER`.
- Applied via [new private SQL](https://github.com/deyanpetrus/privacy-policy/blob/main/lifedashpro/transit/discovery/de_regional_bus_pack_v1.sql).
- [Daily guarded GitHub importer](https://github.com/deyanpetrus/privacy-policy/blob/main/lifedashpro/transit/next_de_regional_bus_expansion.py) with tenant pin, ZIP limit 330 MiB, post-import DB cap 340 MiB, validated destinations, 2-day timetable slice and transaction-safe A/B swap. No change to old H3, existing `transit_data` or original app.
- Validated and imported from fresh national `nv_free` official GTFS. The first run [#43702861460 SUCCESS](https://github.com/deyanpetrus/privacy-policy/actions/runs/43702861460) was followed by a corrected Pfaffenhofen an der Zaber center at **49.067, 8.967** (initial use of 9.051 was wrong). Corrected [run #43703178033 SUCCESS](https://github.com/deyanpetrus/privacy-policy/actions/runs/43703178033).

**Current active corrected A/B pack:** **1,077 served bus stops** and **64,998 SCHEDULED events**, 1,855 stop-day JSON bundles. Within 6km of the three centers:

| Place | Bus stops |
|---|---:|
| Bremen | 518 |
| Pfaffenhofen an der Ilm | 152 |
| Pfaffenhofen an der Zaber | 91 |

These city circles are disjoint, but the overall pack includes extra served stops within 8km of centers; do not add these city counts to compute exact total. Database size after import: **~216 MB**, below configured safety caps. Source: **GTFS.de / DELFI e.V., CC BY 4.0**; preserve attribution including OSM contributor notices as applicable.

Confirmed directly with private SQL:
- Bremen `Am Brill` ~125m from test center: routes **25, 25X**; 44 scheduled entries for Sunday Nov 15 and 70 for Monday Nov 16 for one stop ID (not live).
- Pfaffenhofen a.d. Ilm `Hauptplatz`: routes including **1, 2, 3, 510, 581, 9202**.
- Pfaffenhofen a.d. Zaber `Pfaffenhofen Ortsmitte`: route **661**, ~760m from central reference coordinate.
- Data API is private; checked `anon=false`, `authenticated=false`, `service_role=true` for nearby RPC. A/B active switch confirmed.

## NEXT Edge and app routing

- [`transit-de-regional-bus`](https://github.com/deyanpetrus/privacy-policy/blob/main/lifedashpro/transit/discovery/edge/transit-de-regional-bus/index.ts): **ACTIVE v1**, JWT user verification, rate limit 12/min/user, read-only private RPC for nearby and scheduled stop-based departures.
- [Unified Transit gateway](https://github.com/deyanpetrus/privacy-policy/blob/main/lifedashpro/transit/discovery/edge/transit-shared-cache-next/index.ts): **ACTIVE v5**, JWT required, keyed cache invalidated by v5 namespace; only queries the pilot inside the tested German geography, merges new scheduled stops with countrywide Transitland/DB fallback, preserves separate GTFS platform identifiers, and directs tagged `de-regional-bus` stop departures to the correct pilot API. Existing rural H3 and legacy `transit-schedule` remain available.
- [v5 static TS and pure-function regression test](https://github.com/deyanpetrus/privacy-policy/actions/runs/43703582806): **SUCCESS**.
- **Not yet tested end-to-end with a signed-in NEXT APK.** Existing installed NEXT Android may maintain a local 5-minute cache or may hide stops from a newly introduced provider tag; do not claim phone UI corrected without actual screenshots.

## Compacted selected-stop UI: prepared for user's local E-only project

The standalone compact selected-stop UI ZIP was assembled and its SHA-256 manifest validated. It adds a horizontal selected stop pane, scrollable lines/directions and departure chips, plus More details toggle. **Not installed on the user's Windows E: project or compiled into an APK.** User must extract and run `RUN_NEXT_COMPACT_TRANSIT_E.cmd` and use their established NEXT Release build after preflight passes. Original `C:\lifedashpro` is never changed by the guarded patch.

## Mobility Database vs operational feed

- Metadata catalog `transit_next.mobility_api_feeds`: 1,671 records across 16 countries. Germany: 61 *active-labeled* GTFS listings, 14 of those have a non-null license ID. A catalog item or overlapping geographic footprint **does not prove** Germany bus coverage or redistribution rights.
- The working pilot uses the already licensed GTFS.de national feed rather than importing an unverified candidate (e.g., MVG/MVV with missing catalog license).
- Next non-pilot regional packs: Hamburg/Berlin/Stuttgart/Frankfurt and dedicated `rv_free` regional trains. Strict per-region load limits and A/B rollback; ensure no unbounded full national Supabase import.
- LIVE/GTFS-RT matching, commercial API licensing and GTFS timezone+DST behavior require separate dedicated checks.
- Do not use OpenStreetMap/MapLibre as a **timetable** source; tile features may give some loaded stop coordinates but not authoritative departures.

## Scope protection

Original `C:\lifedashpro`, Play APK, Fuel, navigator and original Supabase were not modified. NEXT-only GitHub scripts and isolated dedicated Supabase Transit project were modified. The signed-in user must test mobile behavior before a rollout can be declared fully successful.
