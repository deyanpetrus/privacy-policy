# LifeDashPro NEXT — first successful German Rural Bus H3 data import

**Date:** 2026-11-15. **Status:** verified/imported (server only). Production Android/Play source unchanged.

## Actual first run

- GitHub Actions [workflow](https://github.com/deyanpetrus/privacy-policy/actions/workflows/lifedashpro-next-rural-bus-h3-refresh.yml), [run #43689824213](https://github.com/deyanpetrus/privacy-policy/actions/runs/43689824213), conclusion **success**.
- Official feed: https://download.gtfs.de/germany/nv_free/latest.zip, 253.87 MiB downloaded, CC BY 4.0 (DELFI e.V. / GTFS.de).
- Validated localized seed stops: **1,465**; active bus trips scanned nationwide: **976,828**; selected actually served local stops **780**.
- **4,709 scheduled departure records** (1,131 on Nov 15 and 3,578 on Nov 16).
- **977** stop-day JSON bundles (not 977 separate departures), **0.53 MiB** compressed JSON payload length.
- Nearby active stops within 6km of centers, counted in *overlapping* circles:
  - Neustadt an der Donau: **66**
  - Bad Gögging: **74**
  - Abensberg: **66**
  - Kelheim: **95**
  - Riedenburg: **50**
  - Altmannstein: **63**
- Dedicated DB `gnqtngtuzbxohgwgvmpb` increased **209.64 → 210.55 MiB** during import; DB size measured separately about **211 MB**.
- Stored in private `transit_next.bus_stops_b`, `transit_next.bus_departures_b`; `bus_meta.active_slot` atomically switched **a→b** on success. `loaded_at` 2026-11-15 07:26:45Z and `expires_at` 2026-11-16 18:26:45Z.
- Source register `de-rural-bus` marked `enabled`.

## Verified direct DB queries

`public.transit_next_bus_nearby(48.806,11.766,6000,40,'bus')` returned **40** stops: 10 within 1km; 14 of the first 40 contain line **6034**.

First nearby examples:

| Distance from test center | Stop | Lines |
|---:|---|---|
| 147 m | Neustadt/Do., Bahnhofstr. | 6008,6012,6034,6055,7530 |
| 331 m | Neustadt/Do., Reg.Str./Sandweg | 6008,6012,7530 |
| 394 m | Neustadt/Do., Sudetenstr. | 6055 |
| 558 m | Neustadt/Do., Volksfestplatz | 6034,6055 |
| 609 m | Neustadt/Donau, Bahnhof | 6008,6012,6034,7530 |

`public.transit_next_bus_departures('220523','2026-11-15')` returned 7 planned departures for **Monday Nov 16**, starting at **06:32** on route 6055. It did not return a Sunday departure for that specific stop. Do not mislabel scheduled results as realtime.

## Operational protections

- Scheduled GitHub refresh at **03:41 UTC every day**, with manual plan/refresh; no need for Windows or APK build.
- Exact dedicated project binding and `verify_target`, same advisory transaction lock as other compact import workflows.
- All limits are fail-closed: downloaded ZIP ≤330MiB, archive expanded ≤7.5GiB, events ≤140k, stored payload ≤12MiB, row caps, database pre-import ≤325MiB and post-import ≤370MiB, geographic validation and Neustadt positive coverage.
- Inactive slot replaced only inside a database transaction; on failed validation old active cache remains and is not overwritten.
- Server API `transit-de-bus-h3` was already deployed and responded 200 before import, but its DB source was empty. Its next signed-in real request **needs device confirmation**. Existing UI may also have React Query/local cache; reopening and pressing refresh in **Bus tab** is the appropriate confirmation step.
- Default **Nearby/Overview** may still show partial legacy `de-national` results. The imported data is available through the **Bus** tab H3 endpoint, not automatically merged into every client widget.
- No fake timetables, on-demand KEXI schedule, or inferred live locations; future service days are refreshed from official feed.
- Licenses/attribution should display `GTFS.de / DELFI e.V. — CC BY 4.0` appropriately.

## Follow-up after actual device test

1. Open LifeDashPro NEXT → Transit → Neustadt an der Donau → **Bus** and use refresh.
2. Verify at least several of the local stops shown above and line 6034, compared to old 2 remote national stops.
3. Tap `Neustadt/Do., Bahnhofstr.` and check scheduled **Monday Nov 16** departures; no fabricated Sunday service.
4. If Bus tab still says `Transit provider unavailable`, diagnose client mapper for H3 `stop_id`/`distance_m` and `boards` response, and compare server Edge invocation logs. Android cannot be considered confirmed until this passes.
