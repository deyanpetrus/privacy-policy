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

## Stage 2: Full GTFS metadata and backend contract parity (16 Oct 2026)

A separate `compact_gtfs_api_parity.py` step now runs after the compact
storage benchmark using **the same disposable local PostgreSQL instance**.
This extends both schemas with complete `routes`, `calendar`,
`calendar_dates` and `shapes` metadata CSVs, then compares:

- All source GTFS metadata rows, with no changed fields.
- Calendar service decisions with additions/cancellations taking priority
  over weekday flags, over 14 days.
- Nearby stops around Regensburg, Munich, Nürnberg and Nittendorf.
- Date-aware timetable departures, route labels/headsign/platform and
  previous-service-day departures for GTFS times beyond 24:00:00 where present.
- Representative trip stop positions, names, raw/reconstructed GTFS times,
  route metadata and sequence; any mismatch makes the job fail.
- Real PostgreSQL heap/index storage for **all** local GTFS tables, not just
  stops/trips/stop_times. The report is in `contract_result.json` alongside
  `result.json` in the same GitHub artifact.

**Scope limitations:** The `nv_free` source has zero `shapes.txt` points in
this LifeDashPro extract, so only stop-based *approximate* geometry can
be tested now; no exact route shape claims. The benchmark compares equivalent
SQL semantics in local copies, **not** a live Android session, Web session,
or production Edge RPC. It does not test storage and WAL spikes during a
database cutover. Use it to decide whether to advance to a dedicated
migration rehearsal, **never** as approval to publish automatically.

The current GTFS feed's service calendars still expire on 19 Oct 2026.
Neither this PR nor the benchmark refreshes it. Production Edge v14 remains
locked and no data in the user's Supabase project is changed.

## Stage 3: Transactional compatibility view switch / rollback rehearsal

The full API parity benchmark successfully completed (user-provided GitHub
artifact, Oct 16): **3,010 service-calendar decisions**, 8 nearby checks,
168 departure windows, 24 routes, including a 24h+ after-midnight departure.
Across all seven GTFS tables, **274.63 MB legacy vs 169.55 MB compact**
(38.26% savings); 1,455,755 stop-time records changed **zero** fields.

A new `compact_gtfs_cutover_rehearsal.py` step runs next in the **same
ephemeral local PostgreSQL 16 GitHub runner**:

1. Create `runtime_bench.stop_times` view over legacy source; collect sample
   trips and timings.
2. Start a SQL transaction, replace the view with an equivalent read layer
   over compact numeric-key storage, and **ROLLBACK**. Confirm the original
   legacy view and sample records survive unchanged.
3. Commit a second transactional switch to the compact view. Compare all
   stop_time records, including fully reconstructed GTFS HH:MM:SS values,
   against legacy source using a LEFT JOIN on source/trip/sequence.
4. Commit a separate emergency fallback switch to legacy view; confirm
   samples are still unchanged.
5. Fail on any mismatch; report `cutover_result.json` in GitHub artifact and
   Actions summary.

**Important limitations:** This rehearsal only proves *view routing* on an
isolated database. It does **not** execute or prove a safe in-place migration
of current production tables and RPCs. Temporary old+new tables and WAL may
exceed the Supabase Free-plan DB/disk headroom. It does not backup or restore
the actual user database and does not authorize `publish`.

Supabase `transit-schedule` v14, Android APK/AAB, Play Store, Web, user data
and all production GTFS remain unchanged. Release automation stays locked.
