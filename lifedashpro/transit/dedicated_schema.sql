-- LifeDashPro dedicated Transit data store — new/empty project ONLY.
-- PRIVATE non-API schema. NEVER execute on existing LifeDashPro project.
-- DDL is additive; fails if namespace already exists. No DROP/DELETE.
-- Install only after project selection, confirmed cost, backup and approval.

begin;

create schema transit_data;
revoke all on schema transit_data from public;
revoke all on schema transit_data from anon, authenticated;

create table transit_data.feeds (
    feed_source text primary key,
    feed_name text not null,
    region text not null,
    timezone text not null,
    source_url text not null,
    active boolean not null default false,
    imported_at timestamptz not null default now(),
    selected_from date not null,
    selected_until date not null,
    metadata jsonb not null default '{}'::jsonb,
    check (selected_until >= selected_from)
);

create table transit_data.stops (
    stop_key integer generated always as identity primary key,
    feed_source text not null references transit_data.feeds(feed_source),
    stop_id text not null,
    stop_name text,
    stop_code text,
    parent_station text,
    platform_code text,
    stop_lat double precision,
    stop_lon double precision,
    unique (feed_source, stop_id),
    check (stop_lat between -90 and 90),
    check (stop_lon between -180 and 180)
);
create index transit_stops_lat_lon_idx on transit_data.stops(stop_lat,stop_lon);

create table transit_data.routes (
    route_key integer generated always as identity primary key,
    feed_source text not null references transit_data.feeds(feed_source),
    route_id text not null,
    agency_id text,
    route_short_name text,
    route_long_name text,
    route_type integer,
    route_color text,
    route_text_color text,
    unique(feed_source,route_id)
);

create table transit_data.trips (
    trip_key integer generated always as identity primary key,
    feed_source text not null references transit_data.feeds(feed_source),
    trip_id text not null,
    route_key integer not null references transit_data.routes(route_key),
    service_id text not null,
    trip_headsign text,
    trip_short_name text,
    direction_id integer,
    shape_id text,
    unique(feed_source,trip_id)
);
create index transit_trips_service_idx on transit_data.trips(feed_source,service_id);

create table transit_data.stop_times (
    trip_key integer not null references transit_data.trips(trip_key),
    stop_sequence integer not null,
    stop_key integer not null references transit_data.stops(stop_key),
    arrival_secs integer,
    departure_secs integer,
    stop_headsign text,
    pickup_type smallint,
    drop_off_type smallint,
    primary key(trip_key,stop_sequence),
    check (arrival_secs >= 0),
    check (departure_secs >= 0)
);
create index transit_stop_times_stop_idx on transit_data.stop_times(stop_key,departure_secs);

create table transit_data.calendar (
    feed_source text not null references transit_data.feeds(feed_source),
    service_id text not null,
    monday boolean,
    tuesday boolean,
    wednesday boolean,
    thursday boolean,
    friday boolean,
    saturday boolean,
    sunday boolean,
    start_date date,
    end_date date,
    primary key(feed_source,service_id)
);
create table transit_data.calendar_dates (
    feed_source text not null references transit_data.feeds(feed_source),
    service_id text not null,
    service_date date not null,
    exception_type integer not null check (exception_type in (1,2)),
    primary key(feed_source,service_id,service_date)
);

create table transit_data.shapes (
    feed_source text not null references transit_data.feeds(feed_source),
    shape_id text not null,
    shape_pt_sequence integer not null,
    shape_pt_lat double precision,
    shape_pt_lon double precision,
    shape_dist_traveled double precision,
    primary key(feed_source,shape_id,shape_pt_sequence)
);

-- Defense in depth: schema is not exposed to anon/authenticated.
-- No public policies; dedicated server-side access only after a separate review.
alter table transit_data.feeds enable row level security;
alter table transit_data.stops enable row level security;
alter table transit_data.routes enable row level security;
alter table transit_data.trips enable row level security;
alter table transit_data.stop_times enable row level security;
alter table transit_data.calendar enable row level security;
alter table transit_data.calendar_dates enable row level security;
alter table transit_data.shapes enable row level security;
revoke all on all tables in schema transit_data from public,anon,authenticated;
revoke all on all sequences in schema transit_data from public,anon,authenticated;
alter default privileges in schema transit_data revoke all on tables from public,anon,authenticated;
alter default privileges in schema transit_data revoke all on sequences from public,anon,authenticated;

commit;
