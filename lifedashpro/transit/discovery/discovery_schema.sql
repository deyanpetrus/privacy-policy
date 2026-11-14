-- Isolated discovery metadata only: no impact on transit_data, current GTFS, or existing Edge functions.
create table if not exists transit_next.discovery_sources (
  feed_id text primary key check (length(feed_id) between 2 and 90),
  display_name text not null,
  category text not null check (category in ('gtfs','gtfs_rt','gbfs')),
  regions text not null default '',
  catalog_url text not null,
  probe_url text not null,
  integration_policy text not null default 'review',
  license_note text not null default 'needs_review',
  refresh_hours integer not null default 24 check (refresh_hours between 1 and 720),
  notes text not null default '',
  probe_state text not null default 'not_checked',
  last_checked_at timestamptz,
  next_check_at timestamptz,
  http_code integer,
  content_length bigint,
  http_last_modified text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table transit_next.discovery_sources enable row level security;
revoke all on transit_next.discovery_sources from public, anon, authenticated;
grant select, insert, update on transit_next.discovery_sources to service_role;
create table if not exists transit_next.discovery_checks (
  check_id bigint generated always as identity primary key,
  feed_id text not null references transit_next.discovery_sources(feed_id),
  checked_at timestamptz not null default now(),
  probe_state text not null,
  http_code integer,
  content_length bigint,
  note text
);
create index if not exists discovery_checks_checked_at_idx on transit_next.discovery_checks(checked_at);
alter table transit_next.discovery_checks enable row level security;
revoke all on transit_next.discovery_checks from public, anon, authenticated;
revoke all on sequence transit_next.discovery_checks_check_id_seq from public, anon, authenticated;
grant select, insert, delete on transit_next.discovery_checks to service_role;
grant usage, select on sequence transit_next.discovery_checks_check_id_seq to service_role;
comment on table transit_next.discovery_sources is 'Read-only source catalog and network health; not an import/activation table; service-only.';
comment on table transit_next.discovery_checks is '45-day bounded historical source-probe checks; no GTFS content is stored.';
