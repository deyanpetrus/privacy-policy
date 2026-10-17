-- LifeDashPro: private dedicated Transit database -> server-only RPC contract
-- TARGET: NEW project gnqtngtuzbxohgwgvmpb ONLY, no changes to old project.
-- PostgREST endpoints are in public schema for private server-to-server use.
-- No anon/authenticated/public grants; ONLY service_role may EXECUTE.
-- Queries are read-only, SECURITY DEFINER with explicitly empty search_path.
-- GTFS stop geometry is approximate from stops (no original shapes in source).
begin;

create function transit_data.service_active(
  p_feed_source text, p_service_id text, p_service_date date
) returns boolean
language sql stable security definer set search_path = ''
as $fn$
  select case
    when exists (
      select 1 from transit_data.calendar_dates cd
      where cd.feed_source=p_feed_source and cd.service_id=p_service_id
        and cd.service_date=p_service_date and cd.exception_type=2
    ) then false
    when exists (
      select 1 from transit_data.calendar_dates cd
      where cd.feed_source=p_feed_source and cd.service_id=p_service_id
        and cd.service_date=p_service_date and cd.exception_type=1
    ) then true
    else coalesce((
      select case extract(isodow from p_service_date)::int
        when 1 then c.monday when 2 then c.tuesday
        when 3 then c.wednesday when 4 then c.thursday
        when 5 then c.friday when 6 then c.saturday
        when 7 then c.sunday else false
      end
      from transit_data.calendar c
      where c.feed_source=p_feed_source and c.service_id=p_service_id
        and p_service_date between c.start_date and c.end_date
    ),false)
  end;
$fn$;

create function transit_data.format_gtfs_seconds(p_seconds integer)
returns text language sql immutable security definer set search_path = ''
as $fn$
  select case when p_seconds is null then null else
    pg_catalog.lpad((p_seconds/3600)::text,2,'0') || ':' ||
    pg_catalog.lpad(((p_seconds%3600)/60)::text,2,'0') || ':' ||
    pg_catalog.lpad((p_seconds%60)::text,2,'0') end;
$fn$;

create function public.transit_gtfs_cache_status()
returns table(feed_source text,name text,region text,priority integer,active boolean,
              imported_at timestamptz,stops bigint,routes bigint,trips bigint,
              stop_times bigint,shape_points bigint)
language sql stable security definer set search_path = ''
as $fn$
 select f.feed_source, f.feed_name, f.region, 10, f.active,f.imported_at,
    coalesce((f.metadata->'counts'->>'stops')::bigint,0),
    coalesce((f.metadata->'counts'->>'routes')::bigint,0),
    coalesce((f.metadata->'counts'->>'trips')::bigint,0),
    coalesce((f.metadata->'counts'->>'stop_times')::bigint,0),
    coalesce((f.metadata->'counts'->>'shape_points')::bigint,0)
 from transit_data.feeds f
 where f.active=true
 order by f.feed_source;
$fn$;

create function public.transit_gtfs_nearby(
 p_lat double precision,p_lon double precision,
 p_radius_m integer default 3000,p_limit integer default 30)
returns table(scoped_id text,feed_source text,stop_id text,stop_name text,
              stop_code text,platform_code text,stop_lat double precision,
              stop_lon double precision,distance_m integer,feed_priority integer)
language sql stable security definer set search_path = ''
as $fn$
 with params as (
 select p_lat lat,p_lon lon,
        greatest(100,least(25000,coalesce(p_radius_m,3000))) radius_m,
        greatest(1,least(100,coalesce(p_limit,30))) lim
 ), candidates as (
  select s.*, f.feed_source source,
     2.0*6371000.0*pg_catalog.asin(pg_catalog.sqrt(
        pg_catalog.power(pg_catalog.sin(pg_catalog.radians(s.stop_lat-p.lat)/2.0),2)+
        pg_catalog.cos(pg_catalog.radians(p.lat)) * pg_catalog.cos(pg_catalog.radians(s.stop_lat)) *
        pg_catalog.power(pg_catalog.sin(pg_catalog.radians(s.stop_lon-p.lon)/2.0),2)
      )) dist_m
  from transit_data.stops s
  join transit_data.feeds f on f.feed_source=s.feed_source and f.active
  cross join params p
  where p.lat between -90 and 90 and p.lon between -180 and 180
    and s.stop_lat between p.lat-p.radius_m/111320.0 and p.lat+p.radius_m/111320.0
    and s.stop_lon between
         p.lon-p.radius_m/greatest(1000.0,111320.0*pg_catalog.cos(pg_catalog.radians(p.lat))) and
         p.lon+p.radius_m/greatest(1000.0,111320.0*pg_catalog.cos(pg_catalog.radians(p.lat)))
 )
 select c.source||':'||c.stop_id, c.source,c.stop_id,c.stop_name,c.stop_code,
        c.platform_code,c.stop_lat,c.stop_lon,
        pg_catalog.round(c.dist_m)::integer,10
 from candidates c cross join params p
 where c.dist_m<=p.radius_m
 order by c.dist_m asc
 limit (select lim from params);
$fn$;

create function public.transit_gtfs_departures(
 p_feed_source text,p_stop_id text,p_service_date date,p_now_seconds integer,
 p_window_minutes integer default 180,p_limit integer default 40)
returns table(feed_source text,stop_id text,trip_id text,route_id text,
 line text,direction text,service_date date,departure_secs integer,
 display_seconds integer,departure_time text,platform_code text)
language sql stable security definer set search_path = ''
as $fn$
 with params as (
  select greatest(0,least(86399,coalesce(p_now_seconds,0))) now_s,
         greatest(1,least(360,coalesce(p_window_minutes,180)))*60 win_s,
         greatest(1,least(100,coalesce(p_limit,40))) lim
 ), selected_stop as (
  select s.stop_key,s.stop_id,s.platform_code,s.feed_source
  from transit_data.stops s
  join transit_data.feeds f on f.feed_source=s.feed_source and f.active
  where s.feed_source=p_feed_source and s.stop_id=p_stop_id
 ), matching as (
  select s.feed_source,s.stop_id,t.trip_id,r.route_id,
         coalesce(nullif(r.route_short_name,''),nullif(r.route_long_name,''),r.route_id) line,
         coalesce(nullif(t.trip_headsign,''),nullif(t.trip_short_name,''),'—') direction,
         p_service_date as service_date,
         coalesce(st.departure_secs,st.arrival_secs) as departure_secs,
         coalesce(st.departure_secs,st.arrival_secs) as display_seconds,
         transit_data.format_gtfs_seconds(coalesce(st.departure_secs,st.arrival_secs)) departure_time,
         s.platform_code
  from selected_stop s
  join transit_data.stop_times st on st.stop_key=s.stop_key
  join transit_data.trips t on t.trip_key=st.trip_key
  join transit_data.routes r on r.route_key=t.route_key
  cross join params p
  where coalesce(st.departure_secs,st.arrival_secs) between p.now_s and p.now_s+p.win_s
    and transit_data.service_active(s.feed_source,t.service_id,p_service_date)
  union all
  select s.feed_source,s.stop_id,t.trip_id,r.route_id,
         coalesce(nullif(r.route_short_name,''),nullif(r.route_long_name,''),r.route_id) line,
         coalesce(nullif(t.trip_headsign,''),nullif(t.trip_short_name,''),'—') direction,
         (p_service_date-1) as service_date,
         coalesce(st.departure_secs,st.arrival_secs) as departure_secs,
         coalesce(st.departure_secs,st.arrival_secs)-86400 as display_seconds,
         transit_data.format_gtfs_seconds(coalesce(st.departure_secs,st.arrival_secs)) departure_time,
         s.platform_code
  from selected_stop s
  join transit_data.stop_times st on st.stop_key=s.stop_key
  join transit_data.trips t on t.trip_key=st.trip_key
  join transit_data.routes r on r.route_key=t.route_key
  cross join params p
  where coalesce(st.departure_secs,st.arrival_secs) between
           86400+p.now_s and 86400+p.now_s+p.win_s
    and transit_data.service_active(s.feed_source,t.service_id,p_service_date-1)
 )
 select m.* from matching m
 order by m.display_seconds
 limit (select lim from params);
$fn$;

create function public.transit_gtfs_trip_route(
 p_feed_source text,p_trip_id text)
returns jsonb
language sql stable security definer set search_path = ''
as $fn$
 with trip as (
  select t.trip_key,t.trip_id,t.feed_source,t.trip_headsign,t.trip_short_name,
         t.shape_id,r.route_id
  from transit_data.trips t
  join transit_data.routes r on r.route_key=t.route_key
  join transit_data.feeds f on f.feed_source=t.feed_source and f.active
  where t.feed_source=p_feed_source and t.trip_id=p_trip_id
 ), route_stops as (
  select st.stop_sequence,s.stop_id,s.stop_name,s.stop_lat,s.stop_lon,
         s.platform_code,st.arrival_secs,st.departure_secs
  from trip t
  join transit_data.stop_times st on st.trip_key=t.trip_key
  join transit_data.stops s on s.stop_key=st.stop_key
 ), stops_json as (
   select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
       'stopId',s.stop_id,'name',s.stop_name,
       'lat',s.stop_lat,'lon',s.stop_lon,
       'arrivalTime',transit_data.format_gtfs_seconds(s.arrival_secs),
       'departureTime',transit_data.format_gtfs_seconds(s.departure_secs),
       'platform',s.platform_code
   ) order by s.stop_sequence),'[]'::jsonb) stops
   from route_stops s
 ), exact_shape as (
   select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'lat',sh.shape_pt_lat,'lon',sh.shape_pt_lon)
      order by sh.shape_pt_sequence) points
   from trip t
   join transit_data.shapes sh on sh.feed_source=t.feed_source and sh.shape_id=t.shape_id
 ), stop_points as (
   select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'lat',s.stop_lat,'lon',s.stop_lon)
      order by s.stop_sequence),'[]'::jsonb) points
   from route_stops s
 )
 select pg_catalog.jsonb_build_object(
   'feedSource',t.feed_source,'tripId',t.trip_id,'routeId',t.route_id,
   'direction',coalesce(nullif(t.trip_headsign,''),nullif(t.trip_short_name,''),'—'),
   'geometryKind',case when pg_catalog.jsonb_array_length(coalesce(ex.points,'[]'::jsonb))>=2
      then 'shape' else 'stops' end,
   'approximate',(pg_catalog.jsonb_array_length(coalesce(ex.points,'[]'::jsonb))<2),
   'points',case when pg_catalog.jsonb_array_length(coalesce(ex.points,'[]'::jsonb))>=2
     then ex.points else sp.points end,
   'stops',sj.stops
 )
 from trip t cross join exact_shape ex cross join stop_points sp cross join stops_json sj;
$fn$;

-- Explicitly hide all public-schema RPCs from mobile/web user roles.
revoke all on function transit_data.service_active(text,text,date) from public,anon,authenticated;
revoke all on function transit_data.format_gtfs_seconds(integer) from public,anon,authenticated;
revoke all on function public.transit_gtfs_cache_status() from public,anon,authenticated;
revoke all on function public.transit_gtfs_nearby(double precision,double precision,integer,integer) from public,anon,authenticated;
revoke all on function public.transit_gtfs_departures(text,text,date,integer,integer,integer) from public,anon,authenticated;
revoke all on function public.transit_gtfs_trip_route(text,text) from public,anon,authenticated;
grant execute on function public.transit_gtfs_cache_status() to service_role;
grant execute on function public.transit_gtfs_nearby(double precision,double precision,integer,integer) to service_role;
grant execute on function public.transit_gtfs_departures(text,text,date,integer,integer,integer) to service_role;
grant execute on function public.transit_gtfs_trip_route(text,text) to service_role;
commit;
