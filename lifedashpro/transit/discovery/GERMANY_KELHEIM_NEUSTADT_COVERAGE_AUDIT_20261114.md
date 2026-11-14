# LifeDashPro NEXT — German Bus Coverage Audit (2026-11-14)

**Scope:** Research and temporary runner-based GTFS audit only. No Android/production navigation or existing transit Data API changes; no database timetable import.

## Verified current-state inventory

- Dedicated Supabase Transit Free `gnqtngtuzbxohgwgvmpb` database stays approximately **209 MB**, Mobility Database API discovery metadata **1,671 records** across 16 countries.
- Existing German `transit_data.de-national` stops count **9,498**, source `nv_free`, latest imported **2026-11-11** with sample service window through **2026-11-24**.
- Current core extractor is strictly limited to **Regensburg, München, Nürnberg, Nittendorf** with **6 km** radius and 7-day service window (see `dedicated_gtfs_import.py` safety preflight).
- There are **zero** stops in local cache whose names contain **Neustadt**, **Abensberg**, or **Gögging**. Geographic check of local records in approximate Neustadt an der Donau rectangle lat 48.73–48.90, lon 11.65–11.90 returned **0**.
- These findings prove *local cache not covering that region*, not that the German national GTFS source lacks it. A previous Android display of Neustadt likely used a different API (not verified).

## VGN GTFS direct read-only audit

- GTFS feed ID: `mdb-858` official VGN, published source [VGN Open Data](https://www.mobil.vgn.de/web-entwickler/open-data/).
- Official license: **CC BY 3.0 DE** with attribution **VGN – Verkehrsverbund Großraum Nürnberg GmbH** (check conditions on source site).
- Verified latest MobilityData-hosted ZIP via temporary GitHub Action [Run 43625049891](https://github.com/deyanpetrus/privacy-policy/actions/runs/43625049891): **1,295 routes; 25,464 stops; 90,753 trips**; valid GTFS calendar services 2026-11-14 = 173, 2026-11-15 = 124, 2026-11-16 = 394.
- Approximate geo stop counts: Nürnberg within 8 km **1,897**; Neustadt an der Donau within 9 km **0**; Abensberg within 8 km **0**; Kelheim within 8 km **0**.
- VGN is **not** a targeted replacement for Kelheim/Neustadt missing coverage. Do not bulk import duplicates.
- Audit did not publish raw ZIP or update Supabase.

## Official sources for target area

- [Stadt Neustadt an der Donau — Mobilität](https://www.neustadt-donau.de/leben-wohnen/mobilitaet): bus timetables via VLK, rail station, and KEXI on-demand.
- [VLK line schedules](https://meinvlk.de/fahrplan-tarife): line **6034** Schwaig/Mühlhausen–Neustadt–Kelheim, **6008** Regensburg–Saal (Donau), **6009** Kelheim–Saal–Abensberg and other regional routes. PDFs are human-readable resources; do not claim automatic GTFS from PDFs.
- [KEXI Neustadt](https://kexi.de/): ride-on-demand; it has service windows but **does not mean fixed GTFS departures are available**.
- [BayernInfo public transport data](https://www.bayerninfo.de/en/about-bayerninfo-1/data-offer/public-transport-data): DEFAS Bavaria static information is included in nationwide DELFI/GTFS, usually weekly, registration for the national download.

## Safe next candidate work, by order

1. **Read-only provider trace on NEXT device** for Neustadt an der Donau to identify source of previously visible results; use named provider and no stale empty-cache negative caching. Existing Android provider fallback must remain untouched.
2. **Determine region availability in current `nv_free` raw ZIP** by reusing an already-scheduled national refresh's downloaded artifact, not a second 270 MB network fetch; inspect stops in an approximately 12 km Neustadt/Abensberg/Kelheim region and active calendars.
3. **Only after confirmed valid subset**, create a NEW separate A/B compact pilot cache (avoid modifying `transit_data` or the four-city safety preflight), mark departures as scheduled, deduplicate, measure DB size and enforce <340 MB preflight/<390 MB after refresh.
4. Preserve Transitland and other provider fallback when no valid local schedule exists; an empty answer must not be treated as absence of local buses.
5. **KEXI must be a distinct on-demand service**, without invented departures, and VLK PDF lines require either a GTFS-compatible authorized source or clearly flagged provider-link access.
6. Continue Germany VGN, regional rail, and the existing compact Sofia provider unchanged.

**Status:** NO additional passenger-facing GTFS imported. No unverified LIVE, no production modifications, and no large Germany download run in this audit.
