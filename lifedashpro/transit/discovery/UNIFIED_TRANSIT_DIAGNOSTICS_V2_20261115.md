# LifeDashPro NEXT — Transit Diagnostics v2 / Germany (2026-11-15)

**Status: deployed (Edge v3), static CI verified, database read permissions validated.**
**Mobile app diagnostic UI update still pending:** existing button says "Check 4 sources", and it cannot yet request further pages or render all diagnostic columns without an E-only NEXT APK update.

## Changes made (NEXT only)

- Enhanced *existing* `transit-provider-audit-stage10e1` (main project `djbxhyhqefylyqqlifan`) to **ACTIVE v3** with `verify_jwt=true`, signed-in user validation, same guarded rate limiter (3 requests per minute/user). Legacy `transit-schedule`, shared-cache v4, Android original, Google Play, Navigator and Fuel unchanged.
- Source arrays now contain **up to 100 items per DB / Transitland page** without previous `MAX=25` truncation. This is a **page size, not a global total limit**; explicit `action=provider-audit-page` uses `offset` for dedicated GTFS, `cursor` for Transitland. Further pages require separate requests and quota; mobile interface doesn't yet expose the Load more control.
- New source-side counts: bus, train, suburban, tram, subway, ferry, unknown; name/line availability and within 1500m/3000m; total matching rows where PostgreSQL can count them, nextCursor/hasMore, duration, errors. Multiple mode categories can overlap for one stop.
- Added existing private **Germany rural bus H3** and **Germany regional rail** to per-location audit alongside national GTFS subset, Transitland, DB transport.rest and Overpass.
- Added **Mobility Database Catalog** and **Supabase shared cache** as **clearly labeled metadata/search-record** panels, never counts of actual stops or departures.
- Added `action=provider-audit-departures` with verified source stop ID: queries the existing authenticated NEXT shared gateway for next 90 minutes and separates live/scheduled/empty/error; does **not** scan departure timetables for every nearby stop (would exhaust quotas).
- Kept old response `providers[]` shape for installed NEXT Android viewer and added optional fields `mobilityDatabase`, `sharedCache`, `pagination`. Existing Android buttons and category display need an APK build to fully use the optional fields.

## Overpass API 406

- The existing `https://overpass-api.de/api/interpreter` returns HTTP 406 for some programmatic clients due to **intentional server User-Agent/Referer policies**, not necessarily invalid OSM data. Corrected request to stable identified `User-Agent: LifeDashPro-TransitDiagnostics/2.0 (+https://mkdigital.app/)` and `Referer: https://mkdigital.app/`, proper form-encoded query, removed `out ... 50` truncation. No silent discarding of returned OSM stops. OSM locations must be labeled **station-only**, no invented departures.
- If the public operator returns 406/429, this client **does not retry or rotate endpoints** and pauses 30 minutes in that Edge isolate. Manual diagnostic only, 3 requests/min/user, one scan at a time. For reliable recurring commercial use, configure an authorized Overpass instance `LDP_OVERPASS_INTERPRETER_URL` managed by the app owner, with acceptable provider-specific credentials, or use a suitable prepared OSM extract. Never insert provider keys into the Android app.
- One-off GitHub Overpass probe [run #43699041849](https://github.com/deyanpetrus/privacy-policy/actions/runs/43699041849) made **one tiny** HTTP request with the proper headers, **no retries**, result **CONNECTION_ERROR** on GitHub hosted runner. This does **NOT** prove a 200 from Supabase Edge nor invalidate the code fix. Genuine signed-in client Overpass result remains to be confirmed. Do **not** say Overpass is confirmed working until live request returns 200. Our container also could not DNS-resolve overpass-api.de.
- References: [Overpass API usage policy](https://wiki.openstreetmap.org/wiki/Overpass_API), [2026 provider policy 406 explainer](https://overpass.ch/guides/overpass-api-406-not-acceptable).

## Dedicated Supabase pages and security

New private `public.transit_next_diagnostic_nearby_page` (`SECURITY INVOKER`, `search_path=''`, execute service_role only, no anon/authenticated execution grants) returns **100 rows per page with offset and exact total_matches** from:
  - `de-national` (existing German subset; not entire national feed),
  - `de-bus-h3` (scheduled rural bus, active slot only),
  - `de-rail` (German regional rail, active slot only).
Narrow service-role-only `USAGE/SELECT` was granted for source tables; `anon` and `authenticated` do not get private schema access.

Actual service-role SQL verification succeeded:
  - Neustadt bus, lat **48.806** lon **11.766**, 6 km: **66 / 66** returned in a single page.
  - Regensburg-region national subset, lat **49.009** lon **12.099**, 6 km: **100 rows on page 1, exact total_matches 1,121**, so the other **1,021** are available through next-page requests (no hard stop at 100). These are raw feed stops; not necessarily 1,121 deduplicated usable bus lines.
  - Regensburg regional rail: **4 / 4**.
  - Shared-cache statistics: **61 cached search records** when checked.

No extra large GTFS ZIP or whole-Germany stop archive was inserted into Supabase during these diagnostic changes.

## Mobility Database: already installed, but metadata-only

`transit_next.mobility_api_feeds` has **1,671 feed catalog rows in 16 countries, 144 German feed listings**:
- **GTFS schedule catalog entries: 102**
- **GTFS-RT realtime feed entries: 25**
- **GBFS shared mobility catalog entries: 17**

The catalog is NOT a location/departure API: listed feeds must be downloaded/licensed/validated/imported or integrated before they can serve stops and journeys. The diagnostics now returns catalog counts and last scan timestamp explicitly. [Official Mobility Database Catalog API](https://mobilitydata.github.io/mobility-feed-api/SwaggerUI/index.html).

## Manual test with existing NEXT APK

1. Open NEXT → Transit Intelligence → Select city → diagnostics button (may still say **Check 4 sources**: static Android text). The server now responds with 6 actual queried sources plus 2 informational sources plus 2 unconnected regional feed cards.
2. Test Neustadt: H3 source should report **66 total matches within 6 km** if radius is set to 6km; 3.5 km can give fewer.
3. Test Obertraubling/Barbing/Pfaffenhofen: verify Transitland returned page, DB errors, Overpass response, and dedicated source totals independently.
4. For a stop ID, call the new diagnostic departures action only if the client implements the action and passes the correct provider-specific ID.
5. **Further pagination and a proper Sources/Cache/Catalog/Departures diagnostic UI require a NEXT-only Android code update and new APK**; this server update cannot rewrite an installed native tab or button label.

### Rollback

Exact old diagnostic source archived at [archive/transit-provider-audit-stage10e1-v1.ts](https://github.com/deyanpetrus/privacy-policy/blob/main/lifedashpro/transit/discovery/edge/archive/transit-provider-audit-stage10e1-v1.ts).
CI: [Diagnostics static workflow run #43698705233 — SUCCESS](https://github.com/deyanpetrus/privacy-policy/actions/runs/43698705233).
