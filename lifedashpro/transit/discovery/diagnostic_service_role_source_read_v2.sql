-- NEXT Transit Diagnostics v2: narrowly scoped read access for a SECURITY INVOKER source-page RPC.
-- No anon/authenticated grants, no RLS bypass added, no changes to transit-schedule.
grant usage on schema transit_data to service_role;
grant select on transit_data.stops, transit_data.feeds to service_role;

-- The diagnostic SQL enumerates all source branches in one SECURITY INVOKER query.
-- Grant only the six required private A/B stop and metadata tables.
grant select on transit_next.bus_stops_a, transit_next.bus_stops_b, transit_next.bus_meta,
  transit_next.rail_stops_a, transit_next.rail_stops_b, transit_next.rail_meta
  to service_role;
