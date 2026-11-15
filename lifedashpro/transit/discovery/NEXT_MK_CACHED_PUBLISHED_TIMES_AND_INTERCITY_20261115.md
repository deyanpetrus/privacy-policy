# LifeDashPro NEXT — MK published timetables and intercity source-reference search
**15 Nov 2026 — Supabase backend deployed. E-only UI ZIP delivered for local Android install.**

## Implemented and verified

- Dedicated private schema: `transit_next.mk_published_schedule_reference`, RLS, SELECT only for service_role; never anon/authenticated. **35 published schedule references**, 7 conditional school-weekday departures for selected official JPS Štip routes, and 28 intercity reference times from the municipality-published Strumica Ekspres page. Deduplicated by stable reference ID; SQL `ON CONFLICT DO NOTHING`. DB cost about **80 KB**, whole Transit database **217 MB**.
- `public.transit_mk_published_departure_reference_search` provides up to 100 results per **page**, with total count, offset and source link. Service-role only, `SECURITY INVOKER`. Search city, origin, destination, local/intercity.
- Invariant: `eligible_for_journey=false` on all 35 because current service validity is unverified. DB check constraints require confirmed current service validity and school calendar before a timetable can be promoted. **This is a source reference catalog, not 35 guaranteed departures today**.
- Štip JPS official: scheduled conditions include school weekdays; some services have separate Saturday/holiday rules. Conservatively imported exactly seven origin departure times directly corroborated on route pages: L1 08:00, L2.2 06:45, L2.3 06:55, L4 12:20, L7.1 06:00, L8 13:45/19:40. The 14 existing route IDs stay untouched. No fictional stop GPS or weekday claims.
- Intercity: Strumica municipality's public `Сообраќај` page lists Strumica Ekspres intercity services between Strumica, Skopje, Bitola, Gevgelija and Sofia with 28 numeric origin times. This website has **no clearly current service validity date**, so all entries are `published_undated`, reference-only. Worker-day/except-Sunday conditions are individually preserved when specified; otherwise `not_specified` (not `daily`). Some times may be obsolete.
- Ministry of Transport preliminary approvals are **not a current operating schedule**. Approved application != today's service, rejected application must never be included. No ministry-decision PDF was ingested into production.
- Existing 5-line/103-stop MK Rail community GTFS untouched. The old verified reference window ends 2026-12-12. Official [MŽI lists a 9 Nov 2026 revision](https://mzi.mk/en/timetable/) which hasn't yet been reconciled, therefore no automatic Journey promotion or LIVE claim.
- Existing `transit-mk-cached-next` Edge **ACTIVE v5**, signed-in user authentication, rate-limited 12/min, supports actions `routes`, `rail`, `overview`, `search`, `rail-departures`. `search` returns separate `routeCatalog`, `publishedConditionalLocal`, `publishedUnverifiedIntercity`, `railRoutes`, with no direct provider calls per user query. The source facts live in shared Supabase and are reusable across all signed-in users.
- Verified SQL real data: exactly **28 intercity refs, 7 Štip refs, 0 journey-eligible**; an actual Strumica→Skopje query returns 10 dated-undetermined reference rows; anon/authenticated have zero direct SQL EXECUTE privileges.
- No changes to original C:\lifedashpro, Navigator, Fuel, Germany GTFS v5, existing Android packages or existing transit endpoints.

## Device UI installation (not yet on user's Windows E:)

A separate incremental ZIP `LifeDashPro_NEXT_MK_CACHED_SEARCH_E_ONLY_20261115.zip` adds collapsible searchable cached Macedonian transit card to **Transit Intelligence** Overview/Lines/Intercity, limited to selected MK country and coordinates. Shows route names, horizontal conditional departure cards, source links, intercity references with warning, and rail route list.

Install only **after** COMPACT TRANSIT FIX2 has passed on E:. Run `RUN_NEXT_MK_CACHED_SEARCH_E.cmd` from extracted ZIP. Strict anchors and TSX-aware parser reject unsupported source code without overwriting. No Gradle build is automatically started; NEXT signed Release APK must be built locally. Static compatibility check passed against the known 2026-11-14 NEXT base plus the installed Compact FIX2 patch pattern. Actual user's E: latest code and signed-in screen have not been end-to-end tested.

## Why not all 14 Štip routes or the entire national intercity timetable immediately?

- An unambiguous stop-specific departure time and operating-day rule must be corroborated at the source. JPS also shows changing "next bus" snippets; cannot turn a dynamically displayed time into a fixed universal timetable for all 14 routes.
- Need official 2026-27 school day/holiday exceptions before calculating upcoming live-like dates, and a reverified 2026 Strumica municipal service bulletin.
- Intercity aggregate sites like Bileto, Atlas MKD, BalkanViator, e-avtobuska have not granted a bulk redistribution feed/license to this project; no scraped timetables imported.
- For complete national route planning, valid, route/stop/trip/calendar linked schedules and official licensing are needed. Cached reference clocks alone cannot prove a same-day journey.

## Provenance

- [JPS Štip routes](https://jps.mk/) and specific route pages.
- [Opština Strumica — traffic/intercity reference](https://strumica.gov.mk/сообраќај/).
- [Strumica May 2026 timetable-change announcement](https://strumica.gov.mk/оглас-за-одобрување-на-возни-редови-за/).
- [Ministry — preliminary intercity application decisions](https://mtc.gov.mk/mk-MK/odnosi-so-javnost/soopstenija/preliminarna-raspredelba-na-avtobuski-linii).
- [MŽI rail timetable listings](https://mzi.mk/en/timetable/).

**Never represent cached bus reference times as LIVE or confirmed operational service until their dates are fully verified.**
