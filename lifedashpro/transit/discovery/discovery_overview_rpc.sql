-- Service-only read-only API for the new optional Transit Sources tab.
-- Security INVOKER: no RLS bypass or anonymous access.
create or replace function public.transit_discovery_overview()
returns table (
  feed_id text, display_name text, regions text, kind text,
  integration_policy text, license_note text, probe_state text,
  http_code integer, last_checked_at timestamptz, next_check_at timestamptz
)
language sql stable security invoker set search_path to ''
as $$
  select s.feed_id,s.display_name,s.regions,s.category as kind,
         s.integration_policy,s.license_note,s.probe_state,
         s.http_code,s.last_checked_at,s.next_check_at
  from transit_next.discovery_sources s
  order by s.regions,s.feed_id
  limit 200;
$$;
revoke all on function public.transit_discovery_overview() from public,anon,authenticated;
grant execute on function public.transit_discovery_overview() to service_role;
