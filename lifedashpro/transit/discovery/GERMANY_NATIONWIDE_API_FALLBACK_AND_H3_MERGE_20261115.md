# LifeDashPro NEXT — Germany-wide API fallback and H3 merge (server-only v3)

**Date** 2026-11-15. Original app and existing `transit-schedule` v21 unchanged. The Android NEXT APK did **not** need a rebuild for this server-side change.

## Observed user problem

- Screenshots around 08:30–08:37 local time on 2026-11-15: selected Neustadt a.d. Donau in **Nearby / All**, UI indicated **CACHED, 2 stops** even after successful H3 import of **780 actual local bus stops**.
- Altmannstein, Painten and Siegenburg showed actual lines from `GTFS.de rural bus subset` in **Bus**/some nearby searches; Pfaffenhofen showed 0, which is outside the current local H3 extract.
- The Android `providerManager.ts` (NEXT overlay) merges H3 into the **All** list only when there are zero stops within **1.8 km**. Two nearby legacy national stops therefore suppress H3. This is a client-side product behavior, separate from whether H3 is populated.
- The existing 24h shared results could cache sparse `de-national` stop entries. An API fallback that only runs after a cache miss cannot fix **incomplete cache hits**.

## Server-only correction

Deployed `transit-shared-cache-next` **v3**, retaining authentication, 40 req/min rate limit, cache privacy and dedicated service-role access. `CACHE_VERSION` bumped to `ldp-transit-shared-v3-de-country-api-h3`, so older 2-stop shared entries do not mask better coverage.

For all German **nearby** searches:
1. Query old GTFS subset plus Transitland/DB fallback via existing **`transit-schedule-next-expanded`** (with legacy backup); that path is countrywide, subject to actual data-provider coverage and provider quotas.
2. If and only if the coordinates are within the bounded area of the verified compact H3 feed (approx 48.62–49.15N, 11.42–12.08E), separately query `transit-de-bus-h3`.
3. Normalize H3 `stop_id,name,lat,lon,distance_m,lines` into compatible stop records tagged `providerId=de-bus-h3,feedSource=de-bus-h3`, so the existing NEXT Android H3 departures route is available on selection. Deduplicate and sort by distance, return at most requested 40 stops. H3 failure must never block the normal API response.
4. Cross-user cache successful merged stops. Incomplete `de-national` results with fewer than 8 stops have a much shorter **120-second** shared TTL (not 24h); own sufficiently populated GTFS may be 24h; externally mixed results normally 1h.
5. Nothing changes for unrelated countries, existing journey routing, POI, navigator or fuel.

## Verification already performed

- Supabase `list_edge_functions` returned `transit-shared-cache-next` **ACTIVE v3** with JWT required, `transit-schedule-next-expanded` ACTIVE v1, `transit-de-bus-h3` ACTIVE v1, and legacy `transit-schedule` ACTIVE v21.
- `get_edge_function` confirmed the v3 cache key, rural H3 API invocation and provider identifiers.
- Dedicated `transit_next.bus_meta` still showed **780 stops**, **4,709** scheduled bus events with valid A/B slot and expiration.
- **No signed-in device end-to-end request was run after deploying v3**, so do not claim the UI is fixed until user tests. The NEXT APK retains ~5 min AsyncStorage cache; use explicit refresh/force fetch or clear only relevant in-memory request, not app data, to retest.

## Limits and next scope

- **No full national GTFS DB is required to attempt online lookups** across Germany. Transitland v2 and the DB transport.rest wrapper support location/departure queries but are **not guarantees of all rural operators**.
- `GTFS.de nv_free/latest.zip` is a static 250+ MiB ZIP, not a live request-response location API. Full national scheduled coverage would require extracting/indexing nationwide GTFS, storing compact regional subsets, or integrating licensing-appropriate official regional APIs; do not mislabel schedule as LIVE.
- Third-party `v6.db.transport.rest` now uses db-vendo-client, warns of lower rate limits and incomplete local bus coverage; `Transitland` coverage depends on ingested operator feeds and allowed licenses.
- Pfaffenhofen, and nationwide city coverage beyond the H3 area, require provider-by-provider positive result checks; zero from external provider is **'no data currently returned'**, never **'no public transport'**.
- Increase geographic shared-key hit rate later with controlled ~100m cells and adjusted distance calculations. Current 4dp location key is ~11m; matches exact normalized searches but not any address for an entire city.

**GitHub source**: [NEXT shared cache Edge implementation](https://github.com/deyanpetrus/privacy-policy/blob/main/lifedashpro/transit/discovery/edge/transit-shared-cache-next/index.ts).
