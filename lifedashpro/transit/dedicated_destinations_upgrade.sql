-- ONLY NEW Supabase project gnqtngtuzbxohgwgvmpb (LifeDashPro Transit).
-- Narrow direction-label improvement: original GTFS headsign wins;
-- if null/empty, use terminal stop name for scheduled route information.
-- Does not change source GTFS tables, calendars, transport clients, or live v15.
-- The user-facing live API remains untouched.
begin;

create or replace function public.transit_gtfs_departures(
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
         coalesce(
           nullif(st.stop_headsign,''), nullif(t.trip_headsign,''),
           nullif(t.trip_short_name,''),
           (select nullif(final_stop.stop_name,'')
            from transit_data.stop_times final_time
            join transit_data.stops final_stop on final_stop.stop_key=final_time.stop_key
            where final_time.trip_key=t.trip_key
            order by final_time.stop_sequence desc limit 1),
           '—') direction,
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
         coalesce(
           nullif(st.stop_headsign,''), nullif(t.trip_headsign,''),
           nullif(t.trip_short_name,''),
           (select nullif(final_stop.stop_name,'')
            from transit_data.stop_times final_time
            join transit_data.stops final_stop on final_stop.stop_key=final_time.stop_key
            where final_time.trip_key=t.trip_key
            order by final_time.stop_sequence desc limit 1),
           '—') direction,
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

create or replace function public.transit_gtfs_trip_route(
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
   'direction',coalesce(nullif(t.trip_headsign,''),nullif(t.trip_short_name,''),nullif(((sj.stops -> -1) ->> 'name'),''),'—'),
   'geometryKind',case when pg_catalog.jsonb_array_length(coalesce(ex.points,'[]'::jsonb))>=2
      then 'shape' else 'stops' end,
   'approximate',(pg_catalog.jsonb_array_length(coalesce(ex.points,'[]'::jsonb))<2),
   'points',case when pg_catalog.jsonb_array_length(coalesce(ex.points,'[]'::jsonb))>=2
     then ex.points else sp.points end,
   'stops',sj.stops
 )
 from trip t cross join exact_shape ex cross join stop_points sp cross join stops_json sj;
$fn$;

-- Enforce server-only execution even if permission state changes in future.
revoke all on function public.transit_gtfs_departures(text,text,date,integer,integer,integer) from public,anon,authenticated;
revoke all on function public.transit_gtfs_trip_route(text,text) from public,anon,authenticated;
grant execute on function public.transit_gtfs_departures(text,text,date,integer,integer,integer) to service_role;
grant execute on function public.transit_gtfs_trip_route(text,text) to service_role;
commit;
