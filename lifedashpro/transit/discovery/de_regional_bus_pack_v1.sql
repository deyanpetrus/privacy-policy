-- LifeDashPro NEXT ONLY, dedicated Transit project gnqtngtuzbxohgwgvmpb.
-- A/B nationwide GTFS.de BUS pilot for Bremen + two distinct Pfaffenhofens.
-- Private tables, no user location/search history, no production/travel/POI changes.
create table if not exists transit_next.de_regional_bus_meta (
 id smallint primary key check(id=1),
 active_slot char(1) not null default 'a' check(active_slot in ('a','b')),
 source text not null default 'GTFS.de NV free / DELFI e.V.',
 loaded_at timestamptz, expires_at timestamptz,
 stops integer not null default 0 check(stops>=0),
 departures integer not null default 0 check(departures>=0),
 license text not null default 'CC BY 4.0'
);
insert into transit_next.de_regional_bus_meta (id) values (1) on conflict(id) do nothing;

create table if not exists transit_next.de_regional_bus_stops_a (
 stop_id text primary key, name text not null, lat double precision not null,
 lon double precision not null, platform text, mode text not null default 'bus',
 lines text[] not null default '{}', check(lat between 47 and 55.3),check(lon between 5 and 16)
);
create table if not exists transit_next.de_regional_bus_stops_b
 (like transit_next.de_regional_bus_stops_a including all);
create index if not exists de_regional_bus_stops_a_coords on transit_next.de_regional_bus_stops_a(lat,lon);
create index if not exists de_regional_bus_stops_b_coords on transit_next.de_regional_bus_stops_b(lat,lon);
create table if not exists transit_next.de_regional_bus_departures_a (
 stop_id text not null, service_date date not null, payload jsonb not null,
 primary key(stop_id,service_date),check(jsonb_typeof(payload)='array')
);
create table if not exists transit_next.de_regional_bus_departures_b
 (like transit_next.de_regional_bus_departures_a including all);

alter table transit_next.de_regional_bus_meta enable row level security;
alter table transit_next.de_regional_bus_stops_a enable row level security;
alter table transit_next.de_regional_bus_stops_b enable row level security;
alter table transit_next.de_regional_bus_departures_a enable row level security;
alter table transit_next.de_regional_bus_departures_b enable row level security;
revoke all on transit_next.de_regional_bus_meta,
 transit_next.de_regional_bus_stops_a,transit_next.de_regional_bus_stops_b,
 transit_next.de_regional_bus_departures_a,transit_next.de_regional_bus_departures_b
 from public,anon,authenticated;
grant usage on schema transit_next to service_role;
grant select,insert,update,delete,truncate on transit_next.de_regional_bus_meta,
 transit_next.de_regional_bus_stops_a,transit_next.de_regional_bus_stops_b,
 transit_next.de_regional_bus_departures_a,transit_next.de_regional_bus_departures_b
 to service_role;

create or replace function public.transit_next_de_regional_bus_nearby(
 p_lat double precision,p_lon double precision,p_radius_m integer default 5000,
 p_limit integer default 100)
returns table(stop_id text,name text,lat double precision,lon double precision,
 distance_m integer,platform text,mode text,lines text[])
language sql stable security invoker set search_path to ''
as $fn$
with cfg as (
 select p_lat la,p_lon lo,least(12000,greatest(250,coalesce(p_radius_m,5000))) rad,
 least(100,greatest(1,coalesce(p_limit,100))) n
 where p_lat between 47 and 55.3 and p_lon between 5 and 16
),
s as (
 select a.* from transit_next.de_regional_bus_stops_a a
 join transit_next.de_regional_bus_meta m on m.id=1 and m.active_slot='a'
 where m.loaded_at>now()-interval '50 hours' and m.expires_at>now()
 union all
 select b.* from transit_next.de_regional_bus_stops_b b
 join transit_next.de_regional_bus_meta m on m.id=1 and m.active_slot='b'
 where m.loaded_at>now()-interval '50 hours' and m.expires_at>now()
),
selected as (
 select s.*, 12742000.0::float8 * asin(sqrt(least(1.0::float8,
 power(sin(radians(s.lat-c.la)/2),2.0::float8)
 + cos(radians(c.la))*cos(radians(s.lat))
 * power(sin(radians(s.lon-c.lo)/2),2.0::float8)))) dist,c.rad,c.n
 from s cross join cfg c
 where s.lat between c.la-0.11 and c.la+0.11
 and s.lon between c.lo-0.18 and c.lo+0.18
)
select k.stop_id,k.name,k.lat,k.lon,round(k.dist)::integer,k.platform,k.mode,k.lines
from selected k where k.dist<=k.rad order by k.dist,k.stop_id
limit (select n from cfg)
$fn$;

create or replace function public.transit_next_de_regional_bus_departures(
 p_stop_id text,p_date date)
returns table(service_date date,payload jsonb)
language sql stable security invoker set search_path to ''
as $fn$
select a.service_date,a.payload from transit_next.de_regional_bus_departures_a a
join transit_next.de_regional_bus_meta m on m.id=1 and m.active_slot='a'
 where m.loaded_at>now()-interval '50 hours' and m.expires_at>now()
 and a.stop_id=p_stop_id and a.service_date=p_date
union all
select b.service_date,b.payload from transit_next.de_regional_bus_departures_b b
join transit_next.de_regional_bus_meta m on m.id=1 and m.active_slot='b'
 where m.loaded_at>now()-interval '50 hours' and m.expires_at>now()
 and b.stop_id=p_stop_id and b.service_date=p_date
$fn$;

revoke all on function public.transit_next_de_regional_bus_nearby(double precision,double precision,integer,integer) from public,anon,authenticated;
revoke all on function public.transit_next_de_regional_bus_departures(text,date) from public,anon,authenticated;
grant execute on function public.transit_next_de_regional_bus_nearby(double precision,double precision,integer,integer) to service_role;
grant execute on function public.transit_next_de_regional_bus_departures(text,date) to service_role;
