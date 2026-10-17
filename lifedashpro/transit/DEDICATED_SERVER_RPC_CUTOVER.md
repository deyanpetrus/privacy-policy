# Dedicated Germany Transit RPC — staged server API cutover (Oct 17, 2026)

**Imported and verified (NEW Supabase only):**
- **LifeDashPro Transit** \`gnqtngtuzbxohgwgvmpb\` / \`eu-west-1\`, Free.
- Feed \`de-national\`, ACTIVE, imported 2026-10-17.
- 9,538 stops, 423 routes, 73,596 trips, 1,420,563 stop-times,
  151 calendars, 105 exceptions, 58,104 24h+ stop-times.
- 193 MB on 500 MB Free DB quota; zero missing stop/trip/route refs.
- Calendar source tables span Oct 17–Nov 16 but **only Oct 17–30
  selection** is validated/advertised as the current cache window.
- Regensburg, Munich, Nuremberg and Nittendorf are covered.

## New private GTFS RPC contract

The one-time migration \`private_dedicated_gtfs_server_rpc_20261017\`
was applied **only to NEW project** \`gnqtngtuzbxohgwgvmpb\`.
It creates four \`public\` PostgREST RPCs with the exact original
LifeDashPro Transit v14 signatures and result keys:

- \`transit_gtfs_nearby\` — scoped GTFS stop IDs, distance, coordinates.
- \`transit_gtfs_departures\` — stops, lines, destination,
  German local GTFS service dates and 24h+ after-midnight windows.
- \`transit_gtfs_trip_route\` — stops and approximate geometry (no
  exact shapes in current German national subset).
- \`transit_gtfs_cache_status\` — active German feed and manifest counts.

Internal \`transit_data.service_active\` handles weekly calendar and
date exceptions. All SIX functions use \`SECURITY DEFINER\` with an
empty SQL search_path. The four public-schema RPCs have
**EXECUTE exclusively for \`service_role\`**:
\`anon=false\`, \`authenticated=false\`, \`service_role=true\`.
They are callable only using a backend secret, never directly from
the user application. The 8 private GTFS tables retain RLS.

Live read-only checks passed on new project:
- Nearby Regensburg Hbf; the shortest stop was ~23m.
- 35–45 matching departures across sampled 3h windows.
- Previous-service-day \`24:11\`, \`24:36\`, \`25:25\` responses correctly
  mapped to 00:11, 00:36 and 01:25 the following morning.
- Full trip route output with ordered stops/points.
- Status row agrees with imported counts.
- All four RPC role/execute grants checked.

The isolated GitHub CI workflow
\`.github/workflows/lifedashpro-dedicated-rpc-test.yml\` reruns parity
and security tests in a **throwaway PostgreSQL 16** service, without
Supabase credentials. CI success is required before client cutover.

## Authenticated preview bridge (not live)

\`lifedashpro/transit/preview/transit-schedule-dedicated-preview/index.ts\`
is a clone of **original LifeDashPro Transit Edge v14** with its existing
authentication and user rate limits preserved. It changes **only
\`transitRpc\`**, so that the four GTFS RPCs are called on NEW Transit
using a server-side key instead of the original database. Its fixed
destination is \`https://gnqtngtuzbxohgwgvmpb.supabase.co\`.

A new separate Edge function name **\`transit-schedule-dedicated-preview\`**
in **OLD** project \`djbxhyhqefylyqqlifan\` can host this code with
\`verify_jwt=true\`; it MUST NOT overwrite existing
\`transit-schedule\` v14. New preview is not used by Android/Web, and
its REST calls fail safely when the secret is not installed.

## Remaining user-side configuration (never put secrets in chat/GitHub)

Use **NEW project's** Dashboard → Settings → API Keys →
**Secret keys**: create/choose a server-only \`sb_secret_...\`
key (NOT publishable/anon), which grants \`service_role\` database
privileges. This bypasses RLS, so guard it carefully.

In **OLD LifeDashPro project** \`djbxhyhqefylyqqlifan\`:
Dashboard → Edge Functions → Secrets, create:

\`LDP_DEDICATED_TRANSIT_SERVICE_ROLE_KEY = <new project secret key>\`

This is a server-only Edge runtime secret. Do NOT place it in GitHub
files, client builds, URLs, Android/Web, app preferences or Supabase
public tables. Do not paste it into this chat. Prefer a dedicated
scoped key that can be rotated without affecting other services.

The API preview uses \`apikey: <secret>\`; opaque \`sb_secret_\` keys
are not user JWTs and must not be sent as \`Authorization: Bearer\`.
Legacy service_role JWTs may additionally use Bearer for PostgREST.

Do not switch the production Android/Web endpoint until an **actual**
authenticated preview call has returned fresh
\`cache-status\`, \`nearby\`, \`departures\`, and \`trip\` correctly, with
fallback rehearsed. The production Edge function version 14 remains
UNCHANGED. No Android APK/AAB change is required once the original
function is safely upgraded separately.

## Refresh is still unsolved

The separate project is already ~193 MB. **Never** rerun the initial
importer: it intentionally rejects a nonempty target. A future
refresh requires off-site backup, verified restore, bounded storage/WAL,
a controlled refresh with rollback, and a monitored schedule. Both
\`LDP_GTFS_AUTOPUBLISH\` and legacy GTFS publishing to original
LifeDashPro remain off. Source validity MUST NOT be fabricated or
extended to cover expired dates.
