# LifeDashPro Transit — separate-database preparation (NOT deployed)

This folder prepares a **dedicated Supabase Transit project**, independent
from the existing LifeDashPro production Supabase project.

## What is implemented

- \`dedicated_schema.sql\`: eight private compact GTFS tables with
  numeric trip/route/stop keys, stop_times, weekly calendars, calendar
  exceptions and a future exact-shapes table.
- All eight tables have RLS enabled, no public policies. The private
  \`transit_data\` schema and tables are explicitly denied to
  \`anon\` and \`authenticated\`.
- \`.github/workflows/lifedashpro-dedicated-schema-test.yml\`: builds
  a throwaway PostgreSQL 16 service and verifies schema, all RLS flags,
  the restricted schema grants and a sample bus+stop+24h departure join.

**This is a schema readiness check.** The full core import is not yet
deployed to any dedicated Supabase project, and the existing Transit v14
does not connect to it. The existing Android APK and Web remain unchanged.

## Capacity and pricing decision

Supabase organization/account assessment in October 2026:

- \`monsiai.apps@gmail.com's Org\` (Free): \`lifedashpro\`
  ACTIVE_HEALTHY and \`NotesPro\` INACTIVE.
- \`deyanpetrushevski-9029's projects\` (Free): \`balkan stay\`
  ACTIVE_HEALTHY and \`mojapcelka\` INACTIVE.

Supabase documents two **active** free projects per owner/admin across
organizations, with paused projects excluded. We have observed two
ACTIVE_HEALTHY projects already. INACTIVE does not give permission to
overwrite or delete either existing project, and does not prove the
project-creation quote would be $0. Before creating the new project:

1. Have user choose an **organization** for a new Transit project.
2. Obtain the exact Supabase project quote through the connector and
   obtain explicit consent if any charge applies.
3. If Free capacity is not available, agree on an alternative:
   additional Supabase account with legitimate free allowance,
   upgrade, or an independently hosted Transit database.
4. Do not reuse any existing NotesPro/balkan stay/mojapcelka project
   without a distinct explicit authorization and independent backup.

## Next gates

- Create a **new, empty** Transit project in the approved organization
  and a similar West Europe region only **after** price confirmation.
- Deploy \`dedicated_schema.sql\` only on the **new** project.
- Implement an isolated, integrity-checked core GTFS importer that
  does not require or print existing LifeDashPro project credentials.
- Confirm storage, 14+ days' schedules, data integrity, trip
  route and real calendar/date semantics.
- Design a server-only adapter (not a client-to-database connection)
  to route existing \`transit-schedule\` read traffic to the new store
  with JWT, per-user quotas, and fallback to v14.
- Deploy the adapter only after isolated tests and approval.
- Turn on scheduled refresh only after a proven **real** core refresh
  and rollback. Never use the old \`de-national\` DELETE/COPY
  auto-publish workflow to update the current 500 MB Free DB.

**NO production GTFS changes, no Android build, no app dashboard changes.**
