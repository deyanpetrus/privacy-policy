# LifeDashPro NEXT Regional Road/Rail and departure pilot (2026-11-16)

## Installed only in Supabase
Main project: `djbxhyhqefylyqqlifan`

- `road-transit-alerts-next` **v2 ACTIVE**, existing v1 contract preserved: POST by authenticated user, `country` ISO2, optional `mode` (all/road/rail/camera), optional `lat` and `lon` for 200 km road filtering.
  - Existing fields: `ok, feature, country, mode, coverage, verifiedAlertCount, alerts, sources, checkedAt, notes`.
  - New: `top_2` returned for compact dashboard and checked `next_transport_notice_v1` records.
  - Source links are **NOT** incident feeds and must not be labeled LIVE.
  - Approved notices must be manually/legally validated, not scraped from sites without verified reuse rights.
- `transit-live-regional-next` **v1 ACTIVE**, additive test only:
  - Switzerland `{country:"CH",station:"Zürich HB"}` or numeric `station_id`.
  - Berlin / Brandenburg `{country:"DE",region:"berlin",stop_id:"900013102",provider:"vbb"}` (bvg optional).
  - 45–60 s shared service-role-only PostgreSQL cache; 50 user cache-miss requests/day.
  - Normalized `departures[]`: `line, destination, scheduled_at, expected_at, delay_minutes, platform, planned_platform, realtime, status`.
  - `LIVE` only when observed delay/prognosis is provided; otherwise `SCHEDULED`.
  - Server deployed and source inspected; **real provider calls with authenticated tester not yet verified**.
- New service-role-only RLS tables:
  - `public.next_transport_notice_v1` (zero approved entries at deploy; date/expiry checks; no anon/auth grants).
  - `public.next_transit_regional_cache_v1` (zero rows until first valid user call; 45/60 s TTL; daily expired-row cleanup scheduled at 03:17 UTC via pg_cron job `lifedash-next-regional-data-cleanup` (job 11)).

## Protected baselines
- Unchanged: `road-eu-v2-read`, `road-eu-v2-sync`, existing German Road Live UI/logic, TomTom usage, Fuel, Navigator, GTFS and all original `C:\lifedashpro`.
- No APK changed or built. The installed E-only country-only/preview card is NOT yet wired to these live functions.
- Existing next Android wiring needs a guarded patch based on **latest** `E:\lifedashpro_NEXT` files and existing authenticated Supabase client helper.
- Source terms/license checks remain required before converting an official link to an automated feed.
- Community VBB/BVG endpoints are Berlin/Brandenburg only; Swiss transport.opendata.ch service asks clients to cache, live data ~30s.
- Abfahrt API 28-country vendor claim, free 100 requests/day and paid from EUR 9/mo; do not assume MK/RS coverage or install key.

## Future testing
1. Authenticated user calls for Zürich HB and Berlin test stop; verify timestamps, platforms, cancellations, correct timezone and cache hit.
2. Verify RLS and no direct data-table grants to clients (done on deployment).
3. Approve one rights-compliant official transport notice with bounded expiration in a **separate review step**; verify v2 filtering and expiry.
4. Connect Near Me / Dashboard card under existing Road Ahead (same-country, max 2 current notices). Show country-level national bulletin separately from 200 km local events.
5. Only then build a single E-only NEXT incremental Release APK using the existing protected Gradle cache; no clean.

```bat
cd /d E:\lifedashpro_NEXT\android
set "GRADLE_USER_HOME=E:\LifeDashPro_BUILD_CACHE\gradle"
set "NODE_ENV=production"
gradlew.bat :app:assembleRelease -Plifedash.allowDebugReleaseSigning=true --build-cache --stacktrace
```
