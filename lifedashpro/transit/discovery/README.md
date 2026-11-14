# LifeDashPro NEXT — European Transit Source Discovery / 14 Nov 2026

**Running mode: source discovery and HTTP metadata checks only. NO active data ingestion from this catalog.**

The user supplied 32 URL occurrences. This catalog deduplicates their 24 **distinct mobility feed records** and preserves five non-feed or direct-reference URLs in `catalog.json`; three feed landing-page URLs were repeats. One license URL is not a GTFS feed. Supported categories are GTFS static (schedules), GTFS Realtime (TripUpdates, ServiceAlerts and/or VehiclePositions), and GBFS (shared bikes/cars).

## How to view source status

- [GitHub Actions — Europe source catalog health](https://github.com/deyanpetrus/privacy-policy/actions/workflows/lifedashpro-transit-discovery-watch.yml): open the latest run. Its **Summary** contains the complete source table and next-check times. The **europe-transit-sources-health** artifact contains `status.md` and `status.json` for 7 days.
- [Supabase dedicated Transit](https://supabase.com/dashboard/project/gnqtngtuzbxohgwgvmpb/editor): inspect `transit_next.discovery_sources` (latest status) and `transit_next.discovery_checks` (45-day history).
- Dashboard read-only query:

```sql
select feed_id,display_name,regions,category,integration_policy,license_note,
       probe_state,http_code,content_length,last_checked_at,next_check_at
from transit_next.discovery_sources
order by regions,display_name;
```

**Important:** `http_reachable_not_validated` only means that an HTTPS endpoint responded. It does **not** certify data validity, GTFS calendar, correct operator, license, completeness, or LIVE freshness. Inaccessible feeds are never automatically deleted from existing caches or Android.

## Read-only ZIP audit and future Android source overview

- [GTFS candidate audit workflow](https://github.com/deyanpetrus/privacy-policy/actions/workflows/lifedashpro-transit-gtfs-candidate-audit.yml) automatically audits `mdb-768` (DE long-distance rail) and `mdb-3043` (HŽPP Croatia) once weekly. A manual `workflow_dispatch` choice audits one additional allowlisted feed. All actual ZIP downloads stay ephemeral and are size capped (25 MiB compressed, 220 MiB expanded); only counts/calendars are uploaded as reports.
- Verified 2026-11-14: DE long-distance `mdb-768` parsed 91 routes, 1,139 stops, 3,910 trips; HR HŽPP `mdb-3043` parsed 143 routes, 460 stops, 44,491 trips. Both had currently active calendar services. These numbers are audited source content, **not imported to the app**.
- A separate Main LifeDashPro **`transit-source-overview-next`** Edge Function (JWT required, v1) can read the compact source registry from the dedicated project's service-only `public.transit_discovery_overview()` RPC. It returns 24 statuses without exposing database keys. It is **not yet wired into the Android Sources tab**, and no signed-in mobile end-to-end request has been tested.
- This new RPC uses **security invoker**, is accessible only by service_role, and the underlying `transit_next.discovery_sources` table retains RLS. An HTTP-OK result is still not a validated service schedule.
- Source-health checker accounts for providers that reject HEAD/return HTTP 404 for HEAD but succeed with a one-byte GET Range request; this caught the JSP Skopje static and ServiceAlerts endpoints without touching existing Skopje fallback.

## Automatic operation

- GitHub workflow `.github/workflows/lifedashpro-transit-discovery-watch.yml` runs at **04:11 UTC daily**, on manifest/script changes, or manually.
- `check_registry.py` performs bounded HEAD requests. If a provider rejects HEAD, only a one-byte Range request is attempted. It never downloads ZIP, RT binary payloads, historical archives, or GBFS vehicle positions.
- Saves status and next check timestamp to a **separate, private**, RLS-enabled table in the dedicated Supabase project (using already-connected `LDP_DEDICATED_TRANSIT_DB_URL` only on the GitHub runner). Last 45 days of checks are retained; no credentials are stored in this catalog.
- This new workflow has read-only GitHub permissions and does not modify existing `transit_data`, `transit_next.feed_registry`, active slots, the original Android app, or existing GTFS refresh workflows.
- Public artifact does not contain personal data or API keys.

## Registry (24 feeds)

| Feed ID | Source | Coverage | Format | Import policy | Metadata check |
|---|---|---|---|---|---|
| [gbfs-mikar](https://mobilitydatabase.org/feeds/gbfs/gbfs-mikar) | Mikar car sharing | DE,AT | GBFS | `review_mobility_ui` | 24 h |
| [mdb-3101](https://mobilitydatabase.org/feeds/gtfs_rt/mdb-3101) | GTFS.de DELFI realtime | DE and cross-border | GTFS-RT | `existing_provider` | 24 h |
| [mdb-2393](https://mobilitydatabase.org/feeds/gtfs/mdb-2393) | NVBW Baden-Württemberg aggregate | DE BW plus neighbors | GTFS static | `hold_capacity` | 168 h |
| [mdb-2138](https://mobilitydatabase.org/feeds/gtfs/mdb-2138) | ÖBB old GTFS dataset | AT cross-border | GTFS static | `blocked_stale` | 168 h |
| [gbfs-deer](https://mobilitydatabase.org/feeds/gbfs/gbfs-deer) | Deer e-carsharing | DE BW | GBFS | `review_mobility_ui` | 24 h |
| [gbfs-nextbike_la](https://mobilitydatabase.org/feeds/gbfs/gbfs-nextbike_la) | Nextbike Niederösterreich | AT | GBFS | `review_mobility_ui` | 24 h |
| [mdb-1089](https://mobilitydatabase.org/feeds/gtfs/mdb-1089) | Germany regional trains rv_free | DE cross-border | GTFS static | `existing_provider` | 24 h |
| [mdb-1139](https://mobilitydatabase.org/feeds/gtfs/mdb-1139) | Historical DB/Czech rail GTFS | DE,CZ and neighbors | GTFS static | `blocked_stale` | 168 h |
| [mdb-768](https://mobilitydatabase.org/feeds/gtfs/mdb-768) | Germany long-distance train fv_free | DE cross-border | GTFS static | `review` | 24 h |
| [tdg-52605](https://mobilitydatabase.org/feeds/gtfs/tdg-52605) | BlaBlaCar Bus international | FR,DE,ES,PT and Europe | GTFS static | `hold_license` | 24 h |
| [mdb-3604](https://mobilitydatabase.org/feeds/gtfs/mdb-3604) | Stara Zagora public buses/trolleybuses | BG | GTFS static | `review` | 24 h |
| [mdb-3427](https://mobilitydatabase.org/feeds/gtfs/mdb-3427) | Livnobus intercity bus | BA | GTFS static | `review` | 24 h |
| [mdb-3261](https://mobilitydatabase.org/feeds/gtfs/mdb-3261) | FlixBus regional Sweden feed | SE,DE,PL,DK and subset | GTFS static | `auth_required` | 168 h |
| [mdb-3043](https://mobilitydatabase.org/feeds/gtfs/mdb-3043) | Croatian HŽPP rail and replacement buses | HR | GTFS static | `review` | 24 h |
| [mdb-2910](https://mobilitydatabase.org/feeds/gtfs/mdb-2910) | Gradski Parking Croatia buses | HR | GTFS static | `blocked_stale` | 168 h |
| [tld-4323-tu](https://mobilitydatabase.org/feeds/gtfs_rt/tld-4323-tu) | Transitland TripUpdates (publisher unresolved) | unverified | GTFS-RT | `hold_identity` | 168 h |
| [tld-1071](https://mobilitydatabase.org/feeds/gtfs/tld-1071) | Zagreb ZET trams and buses | HR,Zagreb | GTFS static | `review` | 24 h |
| [mdb-3461](https://mobilitydatabase.org/feeds/gtfs/mdb-3461) | North Macedonia community railway | MK | GTFS static | `existing_provider` | 168 h |
| [mdb-3068](https://mobilitydatabase.org/feeds/gtfs_rt/mdb-3068) | JSP Skopje service alerts | MK | GTFS-RT | `review_rt_match` | 24 h |
| [mdb-3045](https://mobilitydatabase.org/feeds/gtfs/mdb-3045) | JSP Skopje static buses | MK,Skopje | GTFS static | `existing_provider` | 24 h |
| [mdb-3517](https://mobilitydatabase.org/feeds/gtfs/mdb-3517) | Podgorica Putevi urban buses | ME,Podgorica | GTFS static | `review` | 24 h |
| [mdb-3483](https://mobilitydatabase.org/feeds/gtfs/mdb-3483) | ShowMeBus Balkan/Europe intercity | AL plus Europe | GTFS static | `hold_license` | 168 h |
| [mdb-2927](https://mobilitydatabase.org/feeds/gtfs/mdb-2927) | Serbijavoz rail | RS,ME,HU,BA | GTFS static | `review` | 168 h |
| [mdb-2377](https://mobilitydatabase.org/feeds/gtfs/mdb-2377) | Montenegro ŽPCG community railway | ME | GTFS static | `review` | 168 h |

## Critical safety gates before any future real imports

1. **Do not import 24 feeds at once.** Verify producer and terms independently. Mobility Database indexes feeds but does not confer a general license to republish all of them.
2. **Block stale**: mdb-2138 (ÖBB 2024), mdb-1139 (DB 2019), mdb-2910 (Croatia calendar expired October 2026). Investigate replacement producer URLs, never show old departures as current.
3. **Large data**: mdb-2393 Baden-Württemberg catalog archive ~664 MB ZIP, ~4.3 GB expanded; do not download in routine GitHub probes or insert whole feed into Supabase Free. Restrict by region and measure before enabling.
4. **Scope and rights**: mdb-3261 is a *regional* FlixBus GTFS requiring an API key, not all of Europe. tdg-52605 BlaBlaCar Bus uses ODbL; review obligations. mdb-3483 ShowMeBus remains blocked for commercial publication pending permission.
5. **Realtime**: mdb-3101 DELFI GTFS-RT offers *TripUpdates and ServiceAlerts*, not GPS positions. mdb-3068 JSP Skopje is a *ServiceAlerts* feed, not proof of GPS or live predicted arrival times. Match IDs against valid current GTFS before LIVE.
6. **GBFS**: mikar/deer/nextbike are shared mobility systems, **not** city bus or rail lines. Separate the future Mobility view and live-poll policies.
7. **No overriding sources currently working**: German regional rail compact cache, Sofia, Macedonian rail, the existing Skopje path, Transitland fallback, Navigator, Fuel and Google Play testing builds remain unchanged.

## Controlled next stage (not enabled by the discovery workflow)

For each selected source: download only into temporary GitHub runner with strict ZIP and uncompressed size limits, validate `stops/routes/trips/stop_times/calendar/calendar_dates`, service-date coverage, agency timezone, location bounds, license and overlap; estimate Supabase size growth; optionally stage into separate A/B snapshot. Flip the cache only after source-based and mobile tests. Preserve all existing fallback results when a source is unreachable. `AVAILABLE` must never be confused with `LIVE`.

To consume Mobility Database's API for *automatic discovery of entirely new feeds*, an account token can be added later via GitHub Secrets. This version needs **no Mobility Database API token**, because the curated public URLs are reviewed manually.

### Source provenance

Initial links were supplied by the project owner on 2026-11-14, and selected provider identities/metadata were cross-checked against official producer pages, Mobility Database feed pages and its public `MobilityData/mobility-database-catalogs` JSON records. Some landing pages are not accessible or contain historical cached information: the `review` and `hold` statuses indicate that no current live data validity has been claimed.
