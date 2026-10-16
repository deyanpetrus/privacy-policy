# LifeDashPro — GTFS production readiness / decision gate
October 16, 2026. **PRODUCTION MUST NOT BE MODIFIED BY THIS PLAN.**

## Verified green CI result

Source: [GitHub benchmark 38961612049](https://github.com/deyanpetrus/privacy-policy/actions/runs/38961612049).

| Measurement | Confirmed value |
|---|---:|
| Core German areas | Regensburg, München, Nürnberg, Nittendorf |
| Stops | 9,490 |
| Trips | 75,614 |
| stop_times (lossless) | 1,455,755 |
| All seven GTFS table/index sizes — legacy | 275.00 MiB |
| All seven GTFS table/index sizes — compact | 169.55 MiB |
| Full-source compact storage saving | 38.26% (three-table report: 38.38%) |
| Service-date checks | 3,010 |
| Nearby / departures / route checks | 8 / 168 / 24 |
| 24h+ departure | Verified |
| Cutover parity | 1,455,755/1,455,755 rows, 0 mismatches |
| SQL view switch rollback and fallback | PASS |
| Environment | Disposable GitHub PostgreSQL 16; not Supabase |

Some measures are computed on a disposable PostgreSQL 16 database; current Supabase uses PostgreSQL 17. The sample GTFS feed lacks exact shape geometries; routes remain approximated using stops.

## Current Supabase situation — READ-ONLY AUDIT

- The project \`djbxhyhqefylyqqlifan\` is healthy, on **Free**.
- Current database: ~**284 MiB**, including ~**249 MiB** of old GTFS data.
- Old national transit feed last imported Sep 20, 2026, calendar validity ends **Oct 19, 2026**.
- Expected additive compact core: ~**169.55 MiB** before live schema details. 284 + 169.55 ≈ **453.55 MiB** (~91% of 500 MiB Free database size), excluding transient dead tuples, indexes, WAL, disk and rollback backup.
- PostgreSQL WAL directory was observed around **128 MiB**; WAL is a separate disk usage issue, not a free addition to the 500 MiB database-size quota. Compare DB quota AND physical disk space independently.
- Free plan does **not** include scheduled daily dashboard backups. Official source: https://supabase.com/docs/guides/platform/backups . An off-site \`supabase db dump\` plus restore test is required.

A successful isolated SQL **VIEW** switch does not prove production table/schema migration, physical disk capacity, backup restore, client/API compatibility under live load or rollback after a destructive data rewrite.

### RELEASE GATES — all must pass

1. **Independent backup and restore:** a complete off-site database dump including schema, data and relevant roles. Test restore to a separate throwaway database and verify critical user-data tables and GTFS rows. Never place data or credentials in public GitHub artifacts.
2. **Size and availability:** estimate total new schema, old+new coexistence, disk/WAL/temp peak and headroom using the real target environment. Reject any projected near-quota run; a misleading config value must never bypass the gate.
3. **Full serving contract:** prove the current Android and Web requests continue to work through \`transit-schedule\`, including JWT, current rate limits, \`nearby\`, \`departures\`, \`trip\`, \`cache-status\`, after-midnight, no exact shapes. Avoid user-facing apk/aab changes.
4. **Safe cutover:** data loaded and validated before switching readers; atomic switch with tested fallback; independent backups retained. Do not run DELETE + COPY against the Free production DB.
5. **Manual acceptance:** obtain user approval for the chosen hosting/cost/cutover plan, and run one controlled manual refresh. Only then consider scheduled GitHub autopublish, with failure notifications and retention policy.

### Architectural options for the user to choose

**Option A — a *separate* GTFS-serving PostgreSQL project/database (recommended if a free slot/capacity and security model are available):**

- Create an isolated store; import the compact GTFS core (~170 MiB) there, validate, keep main project unchanged.
- Connect LifeDashPro's existing backend to the new GTFS store using server-only credentials. Stage a new Edge function implementation; do **not** overwrite locked \`transit-schedule\` v14 until tested with both Android/Web clients.
- The alternative datastore must enforce authentication, network access and its own rate/usage limits. Never put service-role/database passwords in Android, Web, git or untrusted request parameters.
- The Supabase Free plan offers *at most two projects across organizations where the user owns/admins*; this account already has a \`lifedashpro\` project and another currently **INACTIVE** project. Do not assume a project slot is available or repurpose/delete the other project. Check cost/free-slot and explicitly obtain authorization before provisioning.
- A separate project does not eliminate all cutover risks. The existing client backend would need a separately tested server-only routing change and rollback controls.

**Option B — upgrade Supabase/allocate larger independent database capacity:**

- If budget permits, a larger plan can provide enough headroom for old + new copies, physical backups and testing. Confirm pricing/cost **before** any upgrade or creation.
- Perform backup/restore, a shadow test, then staged copy and zero-mismatch validation. Do not assume plan upgrade automatically makes any migration safe.

**Option C — migrate in-place on current 500 MiB Free database: NOT RECOMMENDED.**

Current baseline + shadow already approaches database limits before WAL/temporary heap/index bloat. A failed migration could make the live database read-only, affecting unrelated user data.

## Emergency continuity

If service calendars expire before approved cutover, do not artificially extend GTFS validity or invent departures. Preserve the fallback mechanisms already in the backend where they provide verified current data; otherwise signal unavailable scheduled data clearly. Prioritize the working four-city footprint before expanding Germany or Balkan coverage.

## Change controls

- Do **not** enable GitHub variable \`LDP_GTFS_RELEASE_APPROVED\`.
- Do **not** enable \`LDP_GTFS_AUTOPUBLISH\`.
- Do **not** trigger \`publish\` in \`lifedashpro-gtfs-refresh.yml\`.
- No changes to production Supabase tables, \`transit-schedule\` v14, Android, AAB/Play Store, Web or existing navigation.
- The only current CI change is updating \`actions/upload-artifact\` to verified \`@v6\` using Node.js 24 to avoid the harmless Node.js 20 deprecation warning.

See [tracker #59](https://github.com/deyanpetrus/privacy-policy/issues/59).
