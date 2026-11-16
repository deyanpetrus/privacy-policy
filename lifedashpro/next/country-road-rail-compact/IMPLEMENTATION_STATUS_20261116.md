# LifeDashPro NEXT · Country Road, Rail and Nearby Departures — 2026-11-16

## Current status
- Server `road-transit-alerts-next` V4 **ACTIVE** and source archived at `lifedashpro/next/road-transit-alerts-next/v4/index.ts`.
- Server `transit-live-regional-next` V3 **ACTIVE** with nearest station discovery using coordinates for Switzerland and VBB Berlin/Brandenburg, source archived at `lifedashpro/next/transit-live-regional-next/v3/index.ts`.
- Other existing sources untouched: `road-eu-v2-read` German Road Live, `transit-sofia-live-next`, `transit-gtfsrt-balkan-next` V2, `transit-abfahrt-next` gated (NOT enabled).
- **E-only Android ZIP generated locally**: `LifeDashPro_NEXT_COUNTRY_ROAD_RAIL_COMPACT_E_ONLY_20261116.zip`. Apply/verify/rollback scripts require the exact **Country Transit Bridge AUTH_FIX2** baseline. Android build NOT executed in this environment.
- Tested locally: TS parser/transpiler, exact baseline match, PRECHECK/APPLY/VERIFY/repeat APPLY/ROLLBACK/precheck, hash mismatch safe stop. No changes to `C:\lifedashpro`, Fuel, Navigator, TomTom, German Road Live provider.

## Server country coverage truth
- Official source catalog grounded in user supplied `QaXGosORkr8o2My0-grok-workspace.zip`, files `src/lib/alerts/{countries.ts,load.server.ts}`: 22 country codes MK BG RS HR SI BA ME GR RO DE AT CH CZ SK HU PL FR NL BE GB IT ES.
- Source catalog **contains official links**, not 22 LIVE APIs. Original Grok code frequently returns 'unavailable' or scrapes headlines/keywords, so we have not reproduced its unverified LIVE labels.
- Only BG Sofia has an additional automated/current GTFS-RT Service Alerts ingestion in V4. Uses official Sofia Traffic protobuf and CC BY 4.0 attribution, feed timestamp freshness <=300s, 7-minute shared server cache, restricted to selected country BG and clearly labeled city scope Sofia.
- Previously approved NOTICE DB may supply country-wide dated announcements if legally/technically validated. No 200-km filter. No fabricated incident counts. Germany Road Ahead retains original client behavior.
- Official regional departure boards: CH transport.opendata.ch nearest station using `/v1/locations?x&y`; DE Berlin/Brandenburg nearest VBB stop using `/locations/nearby?latitude&longitude`. On both providers, direct external endpoint tests via main Supabase returned HTTP 200 and real stop objects on 2026-11-16.
- All other countries show official road/rail portals and current approved notices if present; they do NOT currently have verified auto-LIVE roadwork feeds from Grok.
- Zagreb ZET had TCP/SSL timeout in Supabase; no fictional feed fallback.
- Abfahrt 100/day free key is not connected. The gated NEXT adapter is ready but disabled pending key/permission.

## UI contract of E-only patch
- ONE Road & Transit card for selected GPS/manual country. Existing Germany Road Live card unchanged except short compact rail/transit/departure add-on, duplicate standalone Rail Transit entry removed.
- Country card shows 0–2 approved road incidents when available, 0–2 fresh verified rail/transit notices, 0–3 nearest provider departures (CH/VBB only). Other countries: official links and explicit missing LIVE caveat.
- Display departure time, line, destination, platform, confirmed delay/cancellation, and local minutes-to-depart. Local countdown tick 1 minute, network refresh only each 10 minutes while screen focused. Uses existing JWT client factory getSharedSupabaseClient and Supabase shared cache, no new API keys in APK.
- Tap card/button opens full Road & Transit details with country-wide paged notices, category groupings, official links, and up to 20 local departures. No cross-country demo stops.
- Future: add rights-verified structured road incidents from individual country national DATEX II/NAP, and static GTFS match for BG Sofia/HR Zagreb trip_updates. Only after provider verification.

## Sources
- Original Grok workspace (user-uploaded): `src/lib/alerts/load.server.ts` and `countries.ts`.
- Official Sofia GTFS-RT: https://gtfs.sofiatraffic.bg/api/v1/alerts ; CC BY 4.0 with attribution.
- CH documentation: https://transport.opendata.ch/docs.html
- VBB API: https://v6.vbb.transport.rest/api.html
- NL NDW: https://opendata.ndw.nu/ (SRTI XML)
- ES DGT: https://infocar.dgt.es/ and https://datos.gob.es/en/catalogo/e00130502-incidencias-de-trafico-srti-en-formato-lod-datex-ii
- HAK: https://www.hak.hr/info/stanje-na-cestama/
