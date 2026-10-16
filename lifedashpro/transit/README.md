# LifeDashPro — safe Germany GTFS refresh (October 2026)

This workflow prepares replacement **scheduled** Germany transit data without changing
the Android APK/AAB, Play Store release, Web UI, or `transit-schedule` Edge v14.

## Current production baseline

- `de-national` last imported 2026-09-20.
- Calendar service ends approximately 2026-10-19.
- Database currently ~284 MB; transit GTFS tables ~249 MB (checked 2026-10-16).
- GTFS provider priority remains `de-rvv / de-mvv` (if imported) → `de-national` → Transitland → DB.
- The existing backend JWT, user rate limits, RLS and feed-scoped IDs remain untouched.

## What the GitHub workflow does

`.github/workflows/lifedashpro-gtfs-refresh.yml` checks the public national
source, extracts scheduled trips serving nine test cities, and validates counts
and schedule coverage. The importer deletes/replaces **only** the `de-national`
namespace inside a **single PostgreSQL transaction**, with rollback on failure.

Schedule is **off by default**: the scheduled job is skipped unless
GitHub repository variable `LDP_GTFS_AUTOPUBLISH` is exactly `true`.
Manual workflow runs default to `validate`, which NEVER writes to Supabase.

## First: run a validation without any passwords

1. Go to the GitHub repo → Actions → **LifeDashPro German GTFS refresh**.
2. Select **Run workflow**, choose mode **validate**.
3. Review completion and the downloaded file's service dates/counts.
   **Validate** uses a compact two-city smoke test (Regensburg and Nürnberg,
   8 km around each); it does not attempt all nine production cities. This
   prevents the prior 250,000-trip safety abort seen on Oct 16 in run #1.
   It must never be used as the production replacement dataset.

Even after a good result, production is unchanged. A separate **publish**
run would extract all nine cities at 12 km with the explicit 500,000-trip
memory cap and require database credentials and storage safety gates. Do not
run publish until the actual database quota has been verified.

## Germany Free-plan storage assessment — required before publication

On 2026-10-16 the actual Supabase organization was confirmed as **Free**, with
a **500 MB database size limit**. Current database is **284 MB**; GTFS is
**249 MB**, mainly `transit_gtfs_stop_times` (237 MB, of which indexes 127 MB).
The valid published schedule ends **2026-10-19**.

The user-confirmed initial `validate` run succeeded but tests ONLY
Regensburg and Nürnberg in a limited area; it does **not** refresh Supabase.

**Confirmed old baseline (actual Supabase feed metadata):** the September 20
import covers only **Regensburg, München, Nürnberg and Nittendorf**, 6 km
seed radius and a three-day *service selection window*. The current calendar
nevertheless holds service end dates through **2026-10-19**; do not blindly
extend that calendar or assume future schedules exist.

The succeeding nine-region `assess` run selected **234,818 trips, 948 routes
and 5,405,014 stop_times**, producing a **420 MB stop_times.csv** file by
itself. This is far beyond a safe atomic swap on the Free database.

### Emergency core capacity assessment (no database writes)

Run GitHub Actions **Run workflow → main → mode `core`**. It checks the
same **four existing areas with a 6 km radius**, now with a full 7-day
selection to preserve weekday/weekend service, and validates 14 days of
actual service coverage from GTFS calendars. It prints selected row counts
and CSV sizes; no database credentials or Supabase writes are used.
This mode is intentionally NOT a publication option.

Before replacing the old feed, compare `core` counts, database projected
table/index sizes and temporary disk/WAL footprint. If the new fit is still
unsafe on 500 MB Free, do not attempt the in-place COPY importer: prioritize
a compact regional serving layer with object storage or a paid
database upgrade, only after explicit approval. No data loss is acceptable.

Before ANY database refresh:

1. Run the workflow manually using mode **assess**. This downloads the same
   official source and performs a **read-only nine-area sizing test with 5 km
   radius**. It prints route/trip/stop_time counts and CSV sizes.
2. Compare new extracted dataset with the current database and calculate
   conservative transaction peak and physical disk/WAL overhead.
3. Design and review a space-safe strategy. **Do not perform full
   `DELETE` + `COPY` on 500 MB Free storage**: atomic transactions retain
   old tuples until commit and can exceed the disk or read-only quota.
4. Run an authenticated full backup and a dry-run restore in a separate
   environment before any destructive in-place replacement.
5. Only after controlled testing and an explicit decision set
   GitHub Actions variable `LDP_GTFS_RELEASE_APPROVED=true` to unlock
   publishing. It defaults to locked.
6. After a verified manual refresh, optionally enable the separate
   `LDP_GTFS_AUTOPUBLISH=true` variable. Do not enable this on the
   current Free database before a safe refresh workflow is proven.

If the assessed subset cannot safely fit, use a more compact schema or
an external GTFS data store, not an invented database quota or a risky
production rewrite. Local DB size != peak write-ahead-log / disk usage.

## For a manual publish (after checking your storage quota)

1. In Supabase → Project → **Connect**, copy the **Session pooler** Postgres
   connection string (not the public API key), and fill in your database
   password. GitHub Actions runners generally need IPv4. Do **not** put this
   connection string into a chat, source file or issue.
2. In GitHub repo → Settings → Secrets and variables → Actions → Secrets,
   create a repository Secret named **`LDP_TRANSIT_DB_URL`** containing that
   complete connection string. Never create a public variable for credentials.
3. Find your **database storage quota** in Supabase billing/usage. Under the
   GitHub **Variables** tab, add `LDP_GTFS_DB_LIMIT_MB` with your quota in
   MB (for example `500` only if your actual quota is 500 MB).
4. Manual run → mode **publish**. The guard refuses publication if the new
   feed loses too much coverage, doesn't extend service dates, or would risk
   exhausting your configured storage quota. The DB driver never logs the URL.

**IMPORTANT:** On 2026-10-16, the database was already ~284 MB and GTFS
~249 MB. The default 500 MB limit would FAIL the conservative peak-space
check (expected: do not import). Do not increase `LDP_GTFS_DB_LIMIT_MB`
to bypass this; it must equal the real storage quota. Review database capacity
or choose a more efficient import strategy if on a tight quota.

## Enable automated publish only after a verified manual publish

In GitHub → Settings → Secrets and variables → Actions → Variables, create
**`LDP_GTFS_AUTOPUBLISH`** with value `true`. The workflow then runs on
Monday, Wednesday and Friday at 03:27 UTC. To pause, set it to `false`
or delete the variable; this does not affect Android or Web.

## Important limitations

- Current `de-national` feed is a **selective** nine-city subset, not
  every public-transport stop nationwide. This workflow maintains that scope.
- The public feed has scheduled departure times, not verified realtime
  vehicle positions, delay alerts, or cancellations.
- This workflow does not download/import RVV or MVV regional packages;
  those are separate future additions after source/licence validation.
- Jobs require the GitHub-hosted runner to download a ~250–300 MB ZIP and
  process large GTFS files; no ZIP needs to be downloaded by the user.
- If the job fails, the transaction is rolled back and the old data stays.
  A missed refresh still means existing schedules eventually expire: review
  failed GitHub Actions runs promptly.

## Diagnostic SQL (read-only)

```sql
select feed_source, name, imported_at, feed_start_date, feed_end_date
from public.transit_gtfs_feeds order by priority;

select max(end_date) from public.transit_gtfs_calendar
where feed_source = 'de-national';
```
