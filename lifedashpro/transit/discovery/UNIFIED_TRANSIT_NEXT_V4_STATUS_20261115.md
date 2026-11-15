# LifeDashPro NEXT — Unified Transit Engine v4 (server-side phase 1)

**Implemented 2026-11-15.** Scope: NEXT-only Supabase Transit Edge gateway and private dedicated Transit database. Existing **original Android/Google Play app**, `C:\lifedashpro`, Navigator, POI/Fuel and legacy `transit-schedule` remain unchanged.

## What is actually deployed

| Component | Verified |
|---|---|
| `transit-shared-cache-next` | **ACTIVE v4**, JWT verification ON, existing per-user 40 req/min limit preserved |
| `transit-schedule-next-expanded` | **ACTIVE v1**, DE GTFS+Transitland+DB fallback; old `transit-schedule` v21 remains available as a backup |
| `transit-de-bus-h3` | **ACTIVE v1**, H3 local official GTFS scheduled bus adapter; per-user H3 rate limit 12/min |
| Dedicated `transit_next.bus_meta` | **780 served local bus stops** and **4,709 official scheduled events**, imported via guarded automatic GitHub GTFS workflow |
| `transit_next.shared_lookup_cache_v1` | Existing private service-only table reused; no duplicate tables |
| `public.transit_shared_cache_store_quality_v2` | **New RPC**, service-role only, atomically prevents a lower-score response overwriting a still-fresh higher-score result |
| CI TypeScript/algorithm contract checks | [workflow run #43695172007](https://github.com/deyanpetrus/privacy-policy/actions/runs/43695172007) **SUCCESS** |

**What this means:** endpoint v4 is **deployed and syntactically tested**; real Android requests were **not yet tested after this deployment**. Do not claim device behavior verified.

### Cache-first & API if weak or missing

- Request key is hashed with SHA-256 over **country + coordinate grid (German nearby searches roughly 100m) + search mode + radius + limit**. Does not store raw GPS or user identity; still possible to infer a public search area from stored stop coordinates.
- A 200m request-radius buffer is used for countrywide German nearby results so requests in the same grid cell can reuse the result. When answering, re-measure distances from **the actual requester coordinates**, filter by requested radius/mode and sort by distance. Other countries retain their prior exact coordinate convention for compatibility.
- Nearby result quality reflects number of **actual close stops within 1.5km/3km**, lines and provider diversity. Sparse distant stops do not count as good local coverage.
- A good fresh response is returned directly from Supabase. Partial results are held briefly to avoid duplicate calls but rechecked after at most 30s. Empty/failed responses are never cached in this version.
- The fallback is countrywide via existing `transit-schedule-next-expanded` and legacy backup, **not only the Kelheim region**.
- Inside the validated rural Bavarian area, the H3 GTFS scheduled bus adapter is queried in parallel, merged with other source results, deduplicated and returned in the same nearby response. It does not run for German-only train/metro queries. Outside this H3 region, the server still checks the Germany-wide external providers, even though their regional coverage is not guaranteed.
- Lower-score successful responses cannot erase higher-score fresh rows (SQL-level compare inside one UPSERT).
- Results tagged `de-bus-h3` with stop ID use the H3 official GTFS timetable adapter for departures. **Never interpret numeric rural GTFS stop IDs as DB station identifiers**.
- H3 scheduled departures are never presented as realtime; only results in the requested time window are returned. Times are interpreted in Europe/Berlin; review DST-transition caveats before production-wide release.
- The requests `journey` and `trip` preserve old backend semantics; full itinerary graph from shared stops/trips is **not built yet**.
- Mode parameter `all`, `bus`, `tram`, `rail`/`train`, `sbahn`, `subway`/`metro`, `ferry` is supported server-side; legacy NEXT client still has its own tab routing, so **physical UI unification requires a later, tested NEXT Android change**.

### Time-to-live and quotas

| Kind | v4 rule |
|---|---|
| Good own static GTFS nearby | Up to **24h** |
| Good mixed or external nearby | **1h** (provider terms permitting) |
| Partial nearby, fewer close stops | **2 min**, with recheck after 30 sec |
| Scheduled departures | **45 sec** |
| Confirmed realtime departures | **15 sec** |
| Trip route geometry | Up to **20 min** |
| Empty or error results | **Never stored in shared cache** |

Cached JSON max **64KiB/record**, dedicated cache relation max **20MiB**, and dedicated database safe guard **340MiB** enforced in the SQL function. The original cleanup remains hourly.

### Verification

1. SQL `has_function_privilege`: `anon=false`, `authenticated=false`, `service_role=true`.
2. Atomic service-role transaction: insert score **89**, attempt overwrite with **20**, read back **89** and unchanged row, transaction rollback verified no persistent test record.
3. GitHub Action successfully tested TypeScript transpilation and pure-function contracts (100m geocell, 200m buffer, sparse-vs-dense quality score, transport-mode filtering, no fake train-as-bus, rebase of distances, H3 scheduled-only timetable).
4. Supabase confirms `transit-shared-cache-next` **ACTIVE version 4** with JWT verification, `transit-schedule` **ACTIVE version 21**, H3 **ACTIVE version 1**.
5. Existing cache before a signed-in v4 request still has old unscored `v3` records. New v4 keys cannot hit these and won't overwrite them.
6. **Not yet verified:** device calls after v4, real provider responses in Pfaffenhofen/Altmannstein/Obertraubling, simultaneous users across Edge isolates, and correct date/time UI for rural departures. Avoid implying otherwise.

### Rollback

The exact previous v3 Edge source is preserved at [archive/transit-shared-cache-next-v3-rollback.ts](https://github.com/deyanpetrus/privacy-policy/blob/main/lifedashpro/transit/discovery/edge/archive/transit-shared-cache-next-v3-rollback.ts).

### NEXT acceptance checklist

Using the **same already-installed NEXT Release APK**, open `Transit Intelligence`; use refresh, allow app's AsyncStorage 5min local cache to expire if results look identical.

1. **Neustadt an der Donau** — Overview nearby should show actual local buses together with available rail; Bus tab should still show lines 6008/6012/6034/6055. On a H3 stop, departures must correspond to **that stop ID** and requested Berlin-local time window.
2. **Altmannstein / Painten / Siegenburg** — actual H3 buses within ≤3km (not 7–10km only).
3. **Obertraubling** — original GTFS and/or countrywide API results remain.
4. **Pfaffenhofen** — test disambiguated **Pfaffenhofen an der Ilm, Bayern** vs **Pfaffenhofen an der Zaber, Baden-Württemberg**; no ungrounded zero-transport claim. Outside H3 service area, API returns what providers genuinely support; no guarantee of full coverage.
5. **München/Bremen** — nationwide fallback still engaged; no region-locked Kelheim search.
6. Repeat an identical search: check `sharedCache.hit`, qualityScore, service-role private row growth, and source attribution. Verify retry for weak results rather than long-lived 2-stop cache.

### Next stage not yet implemented

- Android NEXT client integration to drive **Overview / Bus / Train / Departures via same v4 API**; requires tested E-only source patch and a new APK, not merely Edge deployment.
- More official regional GTFS packs where API provider coverage is missing. Large GTFS archives run in GitHub processing, only small validated time windows/regions stored in dedicated Supabase.
- Country/region coverage registry with per-provider success/failure, operator and license metadata; accurate real-time vs scheduled labels.
- Deferred OSM server fallback: existing Android NEXT already has an OSM Overpass fallback for *stops only*, not timetables. Rate limits and attribution must be respected.
- Opt-in smart Journey reuse of GTFS route/trip/stop_times/calendar/transfer graph. Reusing stops alone is insufficient for itinerary routing.
