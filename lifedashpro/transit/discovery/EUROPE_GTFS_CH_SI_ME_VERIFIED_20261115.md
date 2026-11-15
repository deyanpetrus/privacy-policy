# LifeDashPro NEXT — official European GTFS source inspection (2026-11-15)

**Read-only, no existing Supabase transit tables or Android code touched.** The weekly monitored workflow [run #43715589707](https://github.com/deyanpetrus/privacy-policy/actions/runs/43715589707) validated the **official** CH/SI/ME sources using actual downloaded GTFS ZIPs. Its SUCCESS means all audits ran; check `audit_status` and `schedule_usable_today` per country before claiming coverage. Records have **NOT** yet been imported for passengers into NEXT.

| Country/source | Actual parsed stops | Routes (all types) | Current scheduled service | Notes |
|---|---:|---:|---|---|
| Switzerland SKI official GTFS 2026, 2026-11-11 resource | **105,083** | **5,188** | ✅ 12,026 active service IDs and 586,822 active trip rows in next 7 days | 13,781 GTFS stops include platform_code; ZIP 292,257,915 bytes; latest official 2026 source validated |
| Slovenia DUJPP/IJPP official | **9,786** | **2,466** | ✅ 257 active service IDs / 13,307 active trips next 7 days | 1,740 bus route entries; 726 rail route entries; ZIP 40,471,061 bytes |
| Montenegro Podgorica official municipal archive, April 2026 | **719** | **27** | ❌ 0 current active services/trips | **Stale scheduled feed**, should NOT show 2026-11-15 departures. Can consider locations only after usage terms, dedupe, and freshness are confirmed |

### Verified local stop candidates within 6km (not real-time departures)
- **Switzerland:** Zürich 2,537; Bern 1,449; Geneva 2,301; Basel 1,708; Lausanne 1,397.
- **Slovenia:** Ljubljana 209; Maribor 94; Koper 116; Celje 162.
- **Montenegro:** Podgorica 522; Bar 0; Nikšić 0 (this specific **city bus** GTFS is NOT a nationwide archive).
- These are raw GTFS stops, not necessarily distinct passenger stations, matched by platform and not all known to be actively served at those coordinates.

### Official source access and rights
- CH: https://data.opentransportdata.swiss/en/dataset/timetable-2026-gtfs2020 — SKI national timetable; verify SKI reuse terms and commercial/redistribution rights before a user-facing cache.
- SI: https://dujpp.si/gtfs/dujpp-ijpp.zip — official Slovenian NAP lists CC BY-SA 4.0; preserve attribution and review share-alike obligation.
- ME: https://podgorica.me/otvoreni-podaci/ — small official city archive dated 2026-04-06; **not valid for current departure times**. Need newer city timetable/operator GTFS or a stable official API.
- Mobility Database already holds metadata about these and 16 total European countries; **metadata alone is not a working nearby/dispatch provider**.
- Scheduled GTFS != GTFS-RT LIVE. Do not fake countdowns/delays, platforms, or operating routes.

### Implemented automation
- [Source validation script](https://github.com/deyanpetrus/privacy-policy/blob/main/lifedashpro/transit/discovery/audit_europe_ch_si_me_sources.py) uses source-side archive/ZIP-bomb size guards, calendar/trip verification, and defined city coverage.
- [Weekly GitHub validation workflow](https://github.com/deyanpetrus/privacy-policy/blob/main/.github/workflows/lifedashpro-next-europe-official-gtfs-audit.yml) with independent CH/SI/ME jobs and audit JSON artifacts. Runs once weekly, plus on source/workflow changes and manual dispatch. **Never has Supabase credentials and never writes to Supabase**.
- The initial latest Swiss ZIP is substantially larger than catalog sizes; validate source and regional memory footprint before any paid/free-tier import.

### Safe next implementation stages
1. **NEXT-only local compact UI V3** (separate E: patch): put old detailed groups directly under pinned “Show more”, unique source mode colors/emoji and strictly confirmed LIVE green. Working original APK must not be edited. Journey can reuse `transitVisualTokens.ts` once its actual source is inspected; not yet applied in Journey.
2. **Slovenia pilot first:** due to confirmed current schedule and official licensing, ingest only validated small city + upcoming 2-day timetable subsets into NEW private A/B tables, route via a JWT-protected Edge API and preserve existing Transitland fallback. Test signed-in APK, then expand by province/nation as space allows.
3. **Switzerland:** same method but carefully budget source sizes, checked SKI reuse terms; preserve `platform_code`, trip/day IDs and local stop IDs. Do not consume 105k stops directly in free-tier Supabase.
4. **Montenegro:** expose only verified static stop positions as station-only after license/quality audit. Use newer schedules for actual departures; this old Podgorica GTFS must never be presented as realtime/scheduled now.
5. Other Europe: prioritize AT/HR/CZ/HU/IT/FR/PL and Western Balkans by source freshness, published license, geographic gaps, and validation; no assumption that a feed's country tag implies actual coverage.

**Baseline protection:** the current German NEXT v5 A/B data, legacy original Android Google Play, Fuel/POI and Supabase production are unchanged by this discovery stage.
