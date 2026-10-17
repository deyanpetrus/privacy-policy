# LifeDashPro Web v1.39 — Staging release and parity checklist

## Branch and surfaces
- Based on the current GitHub **main** (production v1.37; staging v1.38).
- New versioned v1.39 assets are referenced ONLY by `/lifedashpro/staging/index.html`.
- Canonical `/lifedashpro/index.html`, Android APK and the v1.38 source assets remain unchanged.

## v1.39: Documents Pro
- Narrow metadata-only edit: `name`, `category`, `expiresAt`, `note`, `tags`, `updatedAt`.
- Preservation of existing private Storage path/URI and any other Android-specific fields by spreading the current synced document record; RLS / logged-in user required and best-effort revision freshness check.
- No uploads, file deletions, permissions changes or browser-native Android alarm scheduling.

## v1.39: Journey itinerary editor
- Create/edit `journey_plans_beta` with schemaVersion=2, title/startDate/startTime, 2–15 stops, stop dates/times/modes/notes, and EXPLICITLY selected Photon geocoded places with validated coordinates.
- Keep unknown Android fields on existing plans and stops, keep stored `segments`, `reminders`, `documents`, `travelWorkspace`. New plans use Android-compatible initial arrays.
- Saved itinerary appears in Web Journey and Supabase `user_data`; whether the Android client imports all coordinate metadata must be validated with a TEST account.
- Only point markers + dashed connections for existing Journey map. This is **not** turn-by-turn road routing, offline navigation, a traffic-aware route, or start-Navigator handoff.

## Translation
- The v1.39 touched UI uses 133 12-language dictionary keys matching the existing codes: en, mk, sr, hr, bs, cnr, sl, bg, sq, el, ro, de.
- This does NOT yet mean full Website translation parity; many legacy module strings remain English.

## Known limitations and validation
1. TEST account: edit metadata for a cloud and an Android-local-only document. Verify actual cloud file download still functions and Android expiry/notes reflect new metadata after synchronization.
2. TEST account: save Regensburg → Nürnberg → Munich with 3 selected Photon results and dates/times, refresh browser, open Android Journey and check the route **as an itinerary**.
3. Modify stop order or add an additional stop, verify original notes/packing/reminders on a previously saved trip remain intact. Existing transport segments are preserved but may require user review after stop changes.
4. Simultaneous Web/Android edits should be tested; client-side revision checks are not atomic compare-and-swap.
5. Validate DE, MK and another language; desktop/window/minimized state, 1366px and 390px viewports, failed geocoder/offline, cancellation and refresh.
6. No Android Navigator, SAR, OSRM or Native Notifications code has changed in this stage. Android handoff requires the **current APK** route contract before implementation.

## Security
- Photon results are only accepted by explicit user selection, and coordinates are constrained to valid ranges.
- Fixed Photon HTTPS host; user input sent as encoded query, no HTML injection.
- Supabase user-owned RLS and existing authenticated Web bridge; no new project secrets or service-role keys.
- No penetration test or end-to-end live signed-in browser test has been performed.
