# LifeDashPro NEXT country-wide alerts + GTFS-RT additions (2026-11-16)

## User-approved country scope
- `road-transit-alerts-next` V3 ACTIVE, confirmed 2026-11-16.
- Removed 200-km exclusion; the dashboard/nearby frontend should choose a single ISO2 country from GPS or manually chosen country.
- New notices query is by country only; `lat/lon` remain *optional* for display of distance, never for excluding distant events.
- Pagination: `offset` integer 0..10000, 100 source records/page, response `next_offset` or null. Always use offset=0 for `top_2` on dashboard.
- Security: authenticated JWT and rate limit; only fresh manually reviewed/approved notices; no unofficial website scraping, no invented "Normal Operations".
- **No Android changes**; existing German `Germany Road Live` not modified.

## Sofia and Zagreb RT pilot
- `transit-gtfsrt-balkan-next` V1 ACTIVE (new isolated Edge Function).
- `POST {country:"BG",city:"sofia",action:"trip-updates"}` and `action:"alerts"`. Source: `https://gtfs.sofiatraffic.bg/api/v1/{action}`; official Sofia Municipal GTFS-RT (CC BY 4.0 with attribution).
- `POST {country:"HR",city:"zagreb",action:"trip-updates"}` and `action:"vehicle-positions"`. Source `https://zet.hr/gtfs-rt-protobuf`; ZET Open Licence Croatia, **marked TEST PURPOSE ONLY** and may return timeout. Underlying ZET feed may contain trip and vehicle entities mixed.
- Library: `gtfs-realtime-bindings@1.1.1` pinned; same as existing untouched `transit-sofia-live-next` for GPS.
- Strict timestamp freshness checks: Sofia 5 minutes, ZET 15 minutes; otherwise no LIVE data. Filter stale provider feed.
- Normalizes per-trip/per-stop delay seconds, IDs, schedule relationship, alerts and vehicle coordinates. GTFS-RT updates are *not* stop departure boards until linked with correct local static GTFS `trip_id/stop_id`.
- Shared PostgreSQL cache `public.next_transit_regional_cache_v1`, updated country constraint (CH DE BG HR); 45 seconds; service-role only; RLS enabled. Authenticated account with 40 cache-miss requests/day.
- Cache maintenance job `lifedash-next-regional-data-cleanup` active daily.
- **Provider live end-to-end not tested yet** (no authenticated app call in the connector); launch UI only after verifying response freshness and matching static GTFS.
- No new periodic polling/download cron for Sofia or Zagreb in this pilot. Endpoint fetches on authenticated request, then caches.
- Backend notice list currently has 0 approved current entries and 0 GTFS-RT cached rows as of initial deployment. Thus dashboard will not show real notices until ingested and validated.

## Next integration to E-only Android project
1. Collect latest `E:\lifedashpro_NEXT\app\(tabs)\index.tsx`, `app\apps\near-me-drive.tsx`, `app\apps\transit.tsx`, and current client auth helper.
2. Guarded patch only after matching exact source. Single compact Road Ahead card sorted country-wide; first 1–2 validated rail/transit notices, no false LIVE.
3. Separate transit departures view using static GTFS matching of realtime IDs, with quality labels SCHEDULED vs VERIFIED LIVE and no guesses of platform.
4. One E-only incremental APK; protect `C:\lifedashpro`, Fuel, Navigator and Germany Road Live.

## Additional official STATIC research leads
- Beograd city GTFS: https://data.gov.rs/sr/datasets/gradski-javni-prevoz-u-beogradu-gtfs/ (updated 2026-11-05, NO realtime).
- Beograd suburbs GTFS: https://data.gov.rs/sr/datasets/prigradski-javni-prevoz-u-u-beogradu-gtfs/ (NO realtime).
- Niš GTFS: https://data.gov.rs/sr/datasets/javni-prevoz-i-gtfs/ (no GTFS-RT verified).
- Do not import large archives on Supabase Free before source size and timetable validity review.
