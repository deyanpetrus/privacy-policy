-- NEXT Transit Diagnostics v2: narrowly scoped read access for a SECURITY INVOKER source-page RPC.
-- No anon/authenticated grants, no RLS bypass added, no changes to transit-schedule.
grant usage on schema transit_data to service_role;
grant select on transit_data.stops, transit_data.feeds to service_role;
