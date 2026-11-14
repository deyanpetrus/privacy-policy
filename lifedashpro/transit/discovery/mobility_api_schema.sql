-- Only new isolated catalog metadata. NEVER modifies active GTFS routes/stops/stop_times.
create table if not exists transit_next.mobility_api_feeds (
  feed_id text not null,
  country_code text not null check(country_code ~ '^[A-Z]{2}$'),
  feed_kind text not null check(feed_kind in ('gtfs','gtfs_rt','gbfs')),
  provider text not null default '',
  feed_name text not null default '',
  catalog_status text not null default 'unknown',
  official boolean,
  municipality text,
  subdivision text,
  license_id text,
  auth_type integer,
  latest_dataset_id text,
  service_start date,
  service_end date,
  downloaded_at timestamptz,
  zipped_mb numeric(12,3),
  discovered_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (feed_id,country_code)
);
create index if not exists mobility_api_feeds_country_kind_idx
  on transit_next.mobility_api_feeds(country_code,feed_kind,catalog_status);
create index if not exists mobility_api_feeds_last_seen_idx
  on transit_next.mobility_api_feeds(last_seen_at);
alter table transit_next.mobility_api_feeds enable row level security;
revoke all on transit_next.mobility_api_feeds from public,anon,authenticated;
grant select,insert,update on transit_next.mobility_api_feeds to service_role;

create table if not exists transit_next.mobility_api_country_checks (
  country_code text not null check(country_code ~ '^[A-Z]{2}$'),
  feed_kind text not null check(feed_kind in ('gtfs','gtfs_rt','gbfs')),
  last_checked_at timestamptz not null default now(),
  latest_count integer not null default 0,
  scan_state text not null default 'unknown' check(scan_state in ('complete','truncated')),
  primary key (country_code,feed_kind)
);
alter table transit_next.mobility_api_country_checks enable row level security;
revoke all on transit_next.mobility_api_country_checks from public,anon,authenticated;
grant select,insert,update on transit_next.mobility_api_country_checks to service_role;

create or replace function public.transit_mobility_api_overview(
  p_country text default null,
  p_kind text default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table(
  feed_id text,country_code text,feed_kind text,provider text,feed_name text,
  catalog_status text,official boolean,municipality text,subdivision text,
  license_id text,auth_type integer,service_start date,service_end date,
  zipped_mb numeric,last_seen_at timestamptz
)
language sql stable security invoker set search_path to ''
as $$
  select m.feed_id,m.country_code,m.feed_kind,m.provider,m.feed_name,
         m.catalog_status,m.official,m.municipality,m.subdivision,m.license_id,
         m.auth_type,m.service_start,m.service_end,m.zipped_mb,m.last_seen_at
  from transit_next.mobility_api_feeds m
  where (p_country is null or m.country_code=p_country)
    and (p_kind is null or m.feed_kind=p_kind)
  order by m.country_code,m.feed_kind,m.provider,m.feed_id
  limit least(greatest(coalesce(p_limit,100),1),100)
  offset least(greatest(coalesce(p_offset,0),0),50000);
$$;
revoke all on function public.transit_mobility_api_overview(text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.transit_mobility_api_overview(text,text,integer,integer) to service_role;

create or replace function public.transit_mobility_api_country_summary()
returns table(country_code text,feed_kind text,latest_count integer,scan_state text,last_checked_at timestamptz)
language sql stable security invoker set search_path to ''
as $$
  select c.country_code,c.feed_kind,c.latest_count,c.scan_state,c.last_checked_at
  from transit_next.mobility_api_country_checks c
  order by c.country_code,c.feed_kind
  limit 150;
$$;
revoke all on function public.transit_mobility_api_country_summary() from public,anon,authenticated;
grant execute on function public.transit_mobility_api_country_summary() to service_role;

comment on table transit_next.mobility_api_feeds is 'Mobility Database API discovery metadata only, NOT a timetable cache or production transit feed.';
comment on table transit_next.mobility_api_country_checks is 'Last successful, bounded Mobility Database API country scan; never signifies validated trip schedules.';
