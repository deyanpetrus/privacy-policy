# LifeDashPro NEXT — North Macedonia cached public transport rollout
**2026-11-15. Server-side phase 1 implemented. Not yet wired to Android, and not a nationwide completed timetable.**

## Delivered now

- Existing dedicated **MK Rail community GTFS** preserved **exactly** as imported: 103 stops, 5 routes, 34 trips, 467 stop-time rows, enabled, source declared valid to 2027-12-11 but **actual verified timetable until 2026-12-12 only**. Never mark LIVE. Routes listed: Skopje–Kumanovo, Skopje–Veles, Skopje–Gevgelija, Skopje–Bitola, Skopje–Zelenikovo. Not claiming any currently suspended train runs.
- Private **`transit_next.mk_static_route_catalog`** created with RLS and service-role-only READ. Imported **14 public Štip route names + published stop counts** directly from the operator's [JPS site](https://jps.mk/). Route IDs: 1, 1.1, 2.1, 2.2, 2.3, 3, 3.1, 4, 5, 6, 7, 7.1, 8, 9. Label `CACHED ROUTE LIST · NOT LIVE`; all records explicitly `has_verified_current_departures=false`. No fake stops, platforms, directions or time estimates.
- Imported **2 archival 2025 municipality-published Strumica route references** (2 and 8) into the same table. Both marked **`historic_unverified`** and not asserted current, because a [May 2026 municipal notice](https://strumica.gov.mk/оглас-за-одобрување-на-возни-редови-за/) explicitly addresses schedule changes. Route facts: 2 = Strumica–Prosenikovo–Dobrejci–Strumica, 8 = city circular line 2. Do not display archival details as current departures.
- New private `public.transit_mk_static_route_catalog(city,limit,offset)` RPC (service-role only, paged).
- New private `public.transit_mk_rail_route_catalog()` RPC exposes just the existing 5 rail route descriptors and their service-verified-through dates, without modifying existing rail GTFS tables.
- New main Supabase NEXT Edge Function **`transit-mk-cached-next` v1 ACTIVE, `verify_jwt=true`**, authenticates signed-in users, rate limits 12 req/min/user, calls read-only private RPCs via dedicated server-only service-role key. Actions `routes`, `rail`, `overview`, country `MK`; the `routes` action accepts city `Штип` or `Струмица`. No time prediction, no LIVE, no GPS fabrication.
- Checked SQL with service-role impersonation. `anon` and `authenticated` cannot query private table or invoke the RPC. Security advisor returned only INFO that private RLS table has no policies (intended service-only design). DB `~217 MB`.
- Static GitHub Actions type/security test **[SUCCESS #43709180752](https://github.com/deyanpetrus/privacy-policy/actions/runs/43709180752)**.

## Source audit / next stages

| Source supplied | Real content and decision |
|---|---|
| [Mobility Database mdb-3461](https://mobilitydatabase.org/feeds/gtfs/mdb-3461) | **MK Rail community**, not official. Metadata indexed already; file 0.22 MB, dataset downloaded 2026-10-18, service declared 2026-08-31 to 2027-12-11. Do not overwrite existing verified timetable, whose verified service ends 2026-12-12. |
| [Mobility Database mdb-3045](https://mobilitydatabase.org/feeds/gtfs/mdb-3045) | **JSP Skopje official GTFS**; indexed in source catalog; Nov 14 dataset marked valid 2026-11-13 to 2026-11-24. Already Skopje transit exists separately; avoid duplicative import without reviewing active sync/license. |
| [JPS Štip official](https://jps.mk/) | Publishes 14 local routes, stop names and many date/term-dependent schedules. First phase imported only route identity facts and source links. Next: verify terms/licence, weekday/school-period rules and coordinates, then guarded schedules. |
| [Strumica municipality transit page](https://strumica.gov.mk/сообраќај/) | Published Strumica Ekspres intercity schedules, but city bus operator is a different service. Do not conflate intercity routes with city buses. |
| [Strumica 2025 Gazette (PDF)](https://strumica.gov.mk/wp-content/uploads/2025/04/4.Sl_.-glasnik-br.-4-25.pdf) | Lists city bus line routes/timetable. It is historical; May 2026 notice of new and modified 2026 routes means the old schedule must be revalidated before actionable departure times. |
| [MŽI latest](https://mzi.mk/возен-ред/) | The rail infrastructure manager publishes dated timetable extracts. Use for rail source cross-check and reopening after 2026-12-12; not automatically train realtime. |
| [Atlas MKD timetables](https://atlasmkd.com/vozni-redovi/) | Intercity itinerary search, not an open GTFS license. Use as reference/navigation only until data-use/API rights verified. |
| [Bileto.mk](https://bileto.mk/mk) | Search/book intercity; platform claims 34 MK cities. Use as link/reference, no unrestricted bulk copying or fabricated live/seat availability. |
| [BalkanViator](https://balkanviator.com/mk/) | Independent bus travel search, lacks confirmed bulk redistribution/GTFS licence. Link-only pending terms/API agreement. |
| [e-avtobuska.mk](http://e-avtobuska.mk/PregledVozniRedovi.aspx) | Timetable portal; access was not reliably validated. Do not claim automatic feed imported. |
| [JSP Skopje lines](https://skopjebus.mk/mk/linii/) | Official public bus directory, complementary to its existing GTFS. Source should be verified before public timetable reuse. |
| [JSP route 1](https://skopjebus.mk/mk/schedule/?route=1) | Example live page, not yet a vetted GTFS machine API. |
| [HŽPP GTFS Croatia](https://www.hzpp.hr/GTFS_files.zip) | Valid officially published **Croatian rail**, not a Macedonian source. HŽPP says 2025/26 published schedule runs until 2026-12-12. Do not add full HR feeds to Supabase Free stage; defer until selected rail/Western Balkans needs and updated 2026/27 GTFS is available. |

## What is *not* complete yet

1. The existing Android NEXT UI does not call `transit-mk-cached-next`; a separate **NEXT-only mobile integration and new Release APK** are required to display the new Štip catalog and Strumica historical references.
2. `CACHED ROUTE LIST` is **not the same as stop positions or timetable departures**. No verified full Štip weekday/school calendar, bus stop GPS, official Strumica 2026 stop-by-stop timetable, or national intercity trip graph has been imported.
3. Source download rights, site usage, terms and licence verification must be completed before automating redistribution of operator tables. Do not scrape on every end-user request.
4. Full Macedonian coverage means integrating more city/operator feeds in bounded batches, with provenance, service dates, stale-data warnings, route/stop identity checks, and calendar-aware schedules.
5. The previously prepared Compact Transit UI FIX2 patch and local E: Release build are **separate**. This server stage did not modify E: or C: local files, Google Play, existing Transit gateway, Fuel or Navigator.

## Release smoke test / separate device flow

After `PASS: COMPACT_TRANSIT_TSX_PARSE`, from Windows **CMD**:
```bat
cd /d E:\lifedashpro_NEXT\android
set "GRADLE_USER_HOME=E:\lifedashpro_NEXT\.gradle-user-next"
call gradlew.bat :app:assembleRelease --build-cache --console=plain
```

No Metro; bundle is included in the Release task. First verify that the output APK has a newer timestamp and correct package/signing before installing. This release only contains changes installed into the user's E: folder, **not** the new MK catalog without Android code changes.
