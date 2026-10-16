# LifeDashPro Transit — compact GTFS PostgreSQL benchmark

This is an **offline experiment**, not a database migration or production release.

## Inputs and isolation

The workflow `.github/workflows/lifedashpro-compact-benchmark.yml`
downloads the public German `nv_free` GTFS archive and extracts the same
four-region core scope used in [Core run #38953187745](https://github.com/deyanpetrus/privacy-policy/actions/runs/38953187745):
Regensburg, München, Nürnberg and Nittendorf, 6 km radius, seven-day service
selection. This last successful run contained **9,490 stops, 422 lines,
75,614 trips, 1,455,755 stop_times**. The ZIP is downloaded on the GitHub
runner; no one needs to download or upload it manually.

The isolated PostgreSQL 16 service is created **inside that GitHub Actions
job** with database/user `ldp_gtfs_scratch`, localhost only. No Supabase
connection string, service-role credential, JWT, GitHub repository secrets,
or production database access are supplied. The Python benchmark *refuses*
remote database URLs, a different username, a different database name, or
an already-used scratch database.

## What is compared

The **legacy benchmark** stores raw `feed_source`, `trip_id` and `stop_id`
strings on each stop_times record and builds the two essential production
indexes (feed+trip+sequence and feed+stop+departure).

The **compact prototype** stores those identifiers only once in
`trips`/`stops` dictionaries and stores 32-bit integer references in
the stop_times fact table. It preserves stop sequence, GTFS arrival and
departure seconds, per-stop headsign, and pickup/drop-off types. Departure
time strings can be derived from seconds including GTFS 24h+ service times.
No live API or schema is modified.

The benchmark checks every converted stop_time row against the raw source
for all preserved fields, compares multiple sample departure windows and
long trip stop sequences, measures real heap+index sizes via PostgreSQL
`pg_total_relation_size()`, and reports median query times. An identical
count without exact field equality is **not sufficient**.

**Limitations:** This prototype measures only stops, trips and stop_times,
which dominate size. Routes, calendar tables, geographical shapes and all
production indexes/foreign-key checks need full migration design and
independent testing. It does not prove a live migration will fit the 500 MB
Supabase Free quota: peak old+new tuples, WAL, physical disk, backup,
downtime and RPC compatibility require separate validation. The benchmark
must not be cited as approval to run the legacy production `publish`.

## Running / results

- This workflow runs once on merge of its own source to `main`, and can be
  started again via GitHub → Actions → **LifeDashPro isolated compact GTFS
  benchmark** → **Run workflow**.
- Successful runs display the result in the GitHub job summary and upload
  `lifedashpro-gtfs-compact-benchmark` JSON for 14 days.
- Any mismatch, row loss or less than 5% savings makes the job fail.
- No credentials or production data are included in artifacts.

**Do not set `LDP_GTFS_RELEASE_APPROVED=true` or
`LDP_GTFS_AUTOPUBLISH=true` as a result of this benchmark.**
Keep Transit Edge v14 and Android/Web unchanged until a production-safe
migration is explicitly reviewed, backed up and authorized.

Tracked in [LifeDashPro issue #59](https://github.com/deyanpetrus/privacy-policy/issues/59).
