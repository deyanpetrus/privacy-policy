# LifeDashPro NEXT — shared Transit API cache and safe fallback

**Status 2026-11-14:** isolated server-side lookup cache deployed and SQL read/store security tested; hourly pruning succeeded. Existing `transit-schedule` and original Android Play app are **unchanged**. Android NEXT still needs to run the hash-guarded patch, compile, and pass on-device tests.

## Where it runs

- Main Supabase project `djbxhyhqefylyqqlifan`, Edge **`transit-shared-cache-next`** (JWT protected), deployed as version 1.
- Dedicated Transit project `gnqtngtuzbxohgwgvmpb`: RLS-enabled private `transit_next.shared_lookup_cache_v1`, only service role can access it.
- RPCs `transit_shared_cache_read_v1`, `transit_shared_cache_store_v1`, `transit_shared_cache_prune_v1`, `transit_shared_cache_stats_v1` are `SECURITY INVOKER` and service-role only.
- GitHub [automatic cache cleanup workflow](https://github.com/deyanpetrus/privacy-policy/actions/workflows/lifedashpro-next-shared-transit-cache-cleanup.yml), hourly at xx:23 UTC. [First successful run](https://github.com/deyanpetrus/privacy-policy/actions/runs/43628267120).
- Existing authenticated `transit-source-overview-next` v3 provides `{"action":"shared-cache"}` with counts and allocated relation bytes for a future admin Sources panel. This is not wired into Android yet.

## Cache-to-API lookup

```text
NEXT client nearby/departures/trip request
   -> authenticated shared-cache Edge (JWT + per-user rate limit)
      -> SHA256 shared query key (country, mode/scope, rounded geo coords, temporal window)
         -> fresh cache HIT: return from dedicated Supabase immediately
         -> cache MISS, fail, or expiry: forward to existing transit-schedule Edge
            -> existing de-national GTFS -> Transitland -> DB -> Swiss/JSP fallback
            -> send authoritative response even if cache cannot write
            -> if nonempty, safe, small result, cache for later users
               -> served to any authenticated user searching same normalized scope
```

The server strips `attempts` and other diagnostics before persisting; only allowlisted public transit fields (stop name/id/coordinates/lines, departure time/line/provider, trip map) are cached. GPS coordinate input is rounded to four decimal places and hashed with SHA-256; no raw user identity, trip address or token is written. Empty responses and errors are **not** stored as negatives. Realtime and emergency/hazard reports are **not** 24h-cached.

| Cache kind | Default TTL | Stale-on-failure | Notes |
|---|---:|---:|---|
| `nearby` from own `de-national` GTFS | 24 hours | up to 2h beyond expiration, clearly marked stale | Only known valid local static stop data |
| `nearby` from external source | 1 hour | none | Provider rights must be checked; Transitland attribution required |
| `trip` from own GTFS | 6 hours | none | Geometry and stop order, not arrival predictions |
| `trip` from other providers | 20 minutes | none | No arbitrary downloaded ZIP |
| `departures` scheduled | 45 seconds | none | Time-bucketed request key |
| `departures` realtime | 15 seconds | none | Never marked LIVE if no actual realtime |
| `journey` | **no persistent cache** | none | Forwards to existing live journey provider; static stop caching can support future planner |

Supabase private cache table limit **20 MiB**, item JSON max **64 KiB**, database safety check before storing **340 MiB**, max TTL **24 hours**. Cleanup deletes only expired records. Main app DB was ~345 MiB, so this cache is deliberately isolated in dedicated Transit DB (~210 MiB before first real client request).

**Important:** same city search hits the same cached record only if country, coordinate cell, radius, limit and action match (normalization about 11m). This does not guarantee zero duplicate API calls for concurrent misses; future distributed single-flight claim/lease is a separate optimization.

## Android NEXT safe test patch

A prepared overlay `LifeDashPro_NEXT_SHARED_TRANSIT_CACHE_FALLBACK_E_ONLY_20261114.zip` includes a one-file, hash-guarded replacement to **`services/transit/providerManager.ts`** for the test project **`E:\lifedashpro_NEXT`** only. It changes just the backend `edgeNearby` and `edgeDepartures` to use the new Edge, and keeps the original `fetchTransitScheduleViaEdge` as a fallback if the new service fails. Stage H2B rail/H3 rural bus/Sofia/DB/Transitland/OSM, Journey, Fuel, POI and Navigator remain unchanged.

The apply PowerShell checks the exact package `com.lifedashpro.app.nexttest` and original file SHA; backs up the file before applying. If your NEXT checkout no longer matches the ZIP baseline, **do not force it**: obtain the current project source and rebase.

The TypeScript parser/transpiler check for patched `providerManager.ts` passed (0 syntax errors). **Full typecheck/build and signed-in Android runtime were not tested.** No indication that current installed LifeDashPro clients have switched to the new function.

## Future cross-feature caching policies (not implemented yet)

- POIs and nearby places: 1–24h for reproducible public search results, longer only if Geoapify/other source license allows.
- Weather: 5–30 minutes, different TTLs for static forecasts vs live readings.
- Realtime traffic, roadworks, closures, speed cameras, emergencies: fresh official data, **short TTL**, never force 24-hour caching.
- Geocoding: normalize public place names, avoid storing exact personal/home/work addresses in shared cache.
- Journey: routing graph with `routes/trips/stop_times/calendar/calendar_dates`, transfers, timezones and walking constraints; **a stop list alone cannot produce a valid transit itinerary**. Need a planner with service-date validation, transfer constraints and actual route API as fallback. Current JavaScript journey endpoint remains provider-based.

Licensing must be assessed feed by feed. [Transitland API terms](https://www.transit.land/terms/) require visible Transitland attribution and compliance with underlying feed licenses. Avoid caching or redistributing operator data if its license prohibits it.

## Verified tests

- Dedicated SQL **write -> read -> clean** passed for a synthetic non-user stop entry. RLS enabled and direct `anon`/`authenticated` SELECT/INSERT blocked. Service role has access.
- Hourly GitHub cleanup workflow first run **success**.
- Main `transit-shared-cache-next` deployed **ACTIVE** with `verify_jwt=true`.
- New Edge `transit-source-overview-next` v3 deployed **ACTIVE**.
- Android patch ZIP archive integrity verified and TypeScript syntax checked, but no device/APK build run.

## Acceptance checklist before expanding to original Play app

1. Apply the NEXT-only patch on a matching E: project; if SHA mismatch, do not overwrite.
2. Run NEXT Gradle/TypeScript build and test signed-in Android usage: search Neustadt an der Donau with empty local GTFS, confirm `sharedCache.hit=false` and existing API fallback returns *available* transport if upstream has it.
3. Repeat same location/params from another signed-in test account and confirm `sharedCache.hit=true` and dedicated Supabase row count >0.
4. Verify Bremen and Munich; test nearby, departures, manual refresh, offline/upstream failure, per-provider attribution, quota guard, stale warning and original fallback.
5. Confirm no change to original `C:\lifedashpro`, Google Play track, POI Fuel or route navigation before considering canonical integration.
