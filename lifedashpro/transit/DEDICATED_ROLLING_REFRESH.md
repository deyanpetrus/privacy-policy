# LifeDashPro — automatic rolling GTFS refresh (NEW dedicated project only)

## State, target and scope
- TARGET **ONLY** NEW Supabase \`gnqtngtuzbxohgwgvmpb\` (West EU, Free 500 MB).
- NEVER targets original LifeDashPro \`djbxhyhqefylyqqlifan\` or NotesPro.
- Existing feed \`de-national\`: 9,538 stops, 423 routes, 73,596 trips,
  1,420,563 stop_times; original selection 2026-10-17 through 2026-10-30.
- Production original LifeDashPro Edge \`transit-schedule\` v15 and Android/Web
  stay unchanged; preview uses the new dedicated project only.

## Daily scheduler (enabled after merging)
- GitHub Action: \`.github/workflows/lifedashpro-dedicated-rolling-refresh.yml\`
- Cron: \`02:45 UTC\` daily; GitHub Actions can delay scheduled executions.
- Each day runs tests on disposable local PostgreSQL, then performs
  **read-only** remote connection/RLS/quota/expiry preflight.
- No large download or data writes while >8 days of advertised coverage remain,
  or if the prior refresh was <4 days ago.
- If due, download latest official \`gtfs.de nv_free\` source to ephemeral runner,
  extract only Regensburg/Munich/Nuremberg/Nittendorf (6 km seed, 7 day weekly
  service selection, complete trip paths) and validate next **14 days**.
- Minimum 100MB source archive, >=1,000 scheduled trips/day across the
  14-day window, stable city coverage, stop_times between 500,000 and
  2,500,000 and no abrupt >35% decrease or >50% increase in stop_times.
- New advertised \`selected_until\` MUST extend prior coverage.
- Active feed count must be 1, 8 private tables must all remain RLS-enabled,
  zero anon/auth schema usage, four service_role-only public RPCs, no
  foreign keys from tables OUTSIDE private Transit to the 8 GTFS tables.
- Project URL tenant/ref must be **exactly** the new \`gnqt...\` project;
  the old production secret variable \`LDP_TRANSIT_DB_URL\` must be absent.

## Database refresh and rollback
- A single PostgreSQL transaction obtains an advisory lock, then
  \`TRUNCATE\`s ALL 8 GTFS tables with \`RESTART IDENTITY\` (no CASCADE),
  reloads the compact numerical-key GTFS rows, verifies totals/FKs,
  tests Regensburg nearby RPC and the new 14-day feed window, then commits.
- The existing tables may be briefly read-locked while importing. Avoid
  cutting live mobile/web traffic to this project until a fallback is
  available and latency during refresh has been measured.
- On connection timeout, validation error, quota guard, incomplete COPY,
  restart, wrong project, missing fresh calendars, or any other exception
  BEFORE commit, the **entire transaction is rolled back** and the
  prior confirmed GTFS dataset remains available.
- Conservative projected peak size cap: **450 MiB** in a 500 MB Free
  database. The cap is checked BEFORE data writes and again before commit.
  This accounts for old and new table/index files coexisting during
  transaction and leaves ~50 MiB of quota margin.
- No separate off-database backup is created by this automation. An
  ordinary PostgreSQL transaction is NOT a disaster-recovery backup.
  A tested off-site snapshot/export restore is required before the
  eventual PRODUCTION cutover. The old production Transit v15 remains a
  separate working fallback in the meantime.
- Nightly workloads still depend on GitHub scheduling and external source
  availability; a failed run is visible in Actions, not silently marked
  green. Cron is best-effort, not guaranteed execution time.

## Developer/manual tools
- Action "LifeDashPro NEW Transit rolling GTFS refresh":
  \`mode=plan\` performs **read-only** quota/expiry preflight and runs local
  rollback/commit tests; \`mode=refresh\` also requires exact confirmation
  \`gnqtngtuzbxohgwgvmpb\` before an eligible live update.
- The original dedicated one-time importer workflow is **unchanged** and
  intentionally refuses populated databases.
- Never place \`LDP_DEDICATED_TRANSIT_DB_URL\` connection string anywhere
  except GitHub repository Secrets. Database/Edge service keys must not be
  sent to the client, code repository, public Actions artifacts or chat.
- The GitHub Action writes only NEW project tables. CI test datasets
  never contact a cloud database.
- Verification SQL after first automatic update:
  \`select selected_from,selected_until,imported_at from transit_data.feeds;\`
  and \`select count(*) from transit_data.stop_times;\`
- If a scheduled refresh fails, review sanitized failure category and
  leave existing feed untouched; do not rerun first-only import or
  disable safety limits to force new data.

## Next release gate
Observe at least one real successful automated data rotation AND verify
before/after counts, 14-day schedule coverage, API parity and refresh latency
from an authenticated preview. Then make an independently durable backup,
test a restore, and evaluate traffic fallback **before any production cutover**.
