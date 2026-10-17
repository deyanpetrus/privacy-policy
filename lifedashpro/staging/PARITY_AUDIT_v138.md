# LifeDashPro Web v1.38 — Web/Android parity audit (2026-10-17)

This is an evidence-based code audit, **not** an assertion that all features have been tested in the Android APK. The Web v1.38 work is isolated to /lifedashpro/staging/ versioned assets. The live /lifedashpro/ remains v1.37.

## Currently shared from Supabase
The Web application currently requests these user_data kinds: notes, finance_transactions, finance_goals, family_tasks, documents, vehicles, journey_plans_beta, manual_reminders, travel, radio_favorites, family_members. Account metadata comes from profiles. Existing Web CRUD is available for Notes, Tasks and Finance; Documents has metadata/private cloud file reading, Calendar is a read-only aggregator; Explorer/World are independent live providers.

## Scope added in staging v1.38
- Documents KPI grid: four compact horizontal cards (responsive 2×2), counteracting the global .card grid-column style in Desktop.
- Vehicles: master record create/update/delete, kilometers, insurance/registration/inspection dates, service and fuel history add/edit/remove. Operations reuse the canonical vehicles payload via the same authenticated Web account, preserve unknown Android fields and verify loaded record revisions before write. This is NOT atomic cross-device conflict prevention; test concurrent editing before production.
- 12-language supplement for the touched Documents/Vehicles/Journey surfaces. The large existing Web language pack still contains English strings elsewhere; do not describe this release as a complete full-app localization pass.
- No changes to native Android notifications, insurance reminder scheduling, storage attachments, Finance, Route Planner, Navigator, SAR provider/corridor or GPS.

## Parity gaps and priorities
1. **Localization:** inventory untranslated UI labels in all modules, ensure 12 Android/Web locale codes align, use profiles.language carefully; do not override Android's on-device language preference without testing.
2. **Vehicles:** verify Android's canonical schemas for service/fuel entries and native refresh after Web updates. Browser writes should trigger revision-safe refresh on Android; never promise native alarm scheduling from Web.
3. **Documents:** full Web upload/metadata edit, secure attachment reservation and deletion, Android file URI import, per-user quota checks. Do not insert raw public Storage paths or overwrite Android documents.
4. **Journey vs route navigation:** Web currently reads journey_plans_beta v2 (itinerary and stops); this **does not prove** the Android Navigator can directly open a route. Before shipping a Web route builder, inspect the latest APK route-persistence/handoff contract and implement Android-side “Open saved Web route in Navigator”. Preserve selected route alternatives/waypoints, GPS origin, SAR rules and OSRM recalculation.
5. **Calendar/Reminders/Family:** read-only calendar; native alarms, invitation verification and device notifications remain Android-only; all additions need a cross-platform contract.
6. **Live mobility:** Road Live, transit, borders, cameras, map search and nearby live data providers are separate from synced user records, not simple copies of Android caches.
7. **Security:** use RLS, authenticated owner identity and revision handling for every write; avoid making server RLS or privileged functions broader simply to gain UI parity.

## Browser QA before promoting v1.38
- 12 languages: switch user profile language and verify dynamic, newly opened and restored windows.
- Documents cards at 1920, 1366, 800 and 390px; Desktop/maximized and Classic layouts.
- With a TEST account only: create vehicle, edit dates/KM, add/edit/remove service and fuel entries, refresh, reopen, and confirm Android sees entries after its next sync.
- Verify delete requires confirmation; test stale writes from two devices; check unrelated attachments/reminders/data untouched.
- Check read-only production v1.37 remains functional while the stage branch is merged.
