
create or replace function public.transit_next_diagnostic_nearby_page(
 p_source text,p_lat double precision,p_lon double precision,
 p_radius_m integer default 6000,p_limit integer default 100,p_offset integer default 0)
returns table(source text,stop_id text,name text,lat double precision,lon double precision,
 distance_m integer,platform text,mode text,lines text[],total_matches bigint)
language sql stable security invoker set search_path to ''
as $fn$
with cfg as (
 select p_source src,p_lat alat,p_lon alon,
 least(12000,greatest(500,coalesce(p_radius_m,6000))) rad,
 least(100,greatest(1,coalesce(p_limit,100))) n,
 least(30000,greatest(0,coalesce(p_offset,0))) sk
 where p_source in ('de-national','de-bus-h3','de-rail')
 and p_lat between 47 and 55.3 and p_lon between 5 and 16
),
all_sources as (
 select 'de-national'::text src,s.stop_id::text sid,s.stop_name::text nm,
 s.stop_lat::float8 la,s.stop_lon::float8 lo,
 s.platform_code::text platform,'unknown'::text md,array[]::text[] ln
 from transit_data.stops s join transit_data.feeds f on f.feed_source=s.feed_source and f.active
 cross join cfg c where c.src='de-national'
 union all
 select 'de-bus-h3'::text,s.stop_id,s.name,s.lat,s.lon,s.platform,'bus'::text,s.lines
 from transit_next.bus_stops_a s join transit_next.bus_meta m on m.id=1 and m.active_slot='a'
 cross join cfg c where c.src='de-bus-h3' and m.expires_at>now()
 union all
 select 'de-bus-h3'::text,s.stop_id,s.name,s.lat,s.lon,s.platform,'bus'::text,s.lines
 from transit_next.bus_stops_b s join transit_next.bus_meta m on m.id=1 and m.active_slot='b'
 cross join cfg c where c.src='de-bus-h3' and m.expires_at>now()
 union all
 select 'de-rail'::text,s.stop_id,s.name,s.lat,s.lon,s.platform,s.mode,s.lines
 from transit_next.rail_stops_a s join transit_next.rail_meta m on m.id=1 and m.active_slot='a'
 cross join cfg c where c.src='de-rail' and m.expires_at>now()
 union all
 select 'de-rail'::text,s.stop_id,s.name,s.lat,s.lon,s.platform,s.mode,s.lines
 from transit_next.rail_stops_b s join transit_next.rail_meta m on m.id=1 and m.active_slot='b'
 cross join cfg c where c.src='de-rail' and m.expires_at>now()
),
bounded as (
 select s.*,c.rad,c.n,c.sk,
 12742000::float8*pg_catalog.asin(pg_catalog.sqrt(least(1.0::float8,
 pg_catalog.power(pg_catalog.sin(pg_catalog.radians(s.la-c.alat)/2),2.0::float8)
 +pg_catalog.cos(pg_catalog.radians(c.alat))*pg_catalog.cos(pg_catalog.radians(s.la))
 *pg_catalog.power(pg_catalog.sin(pg_catalog.radians(s.lo-c.alon)/2),2.0::float8)))) dist
 from all_sources s cross join cfg c
 where s.la between c.alat-c.rad/111320.0 and c.alat+c.rad/111320.0
 and s.lo between c.alon-c.rad/greatest(1000.0,111320.0*pg_catalog.cos(pg_catalog.radians(c.alat)))
          and c.alon+c.rad/greatest(1000.0,111320.0*pg_catalog.cos(pg_catalog.radians(c.alat)))
),
eligible as (select *,count(*) over() as cnt from bounded where dist<=rad)
select e.src,e.sid,e.nm,e.la,e.lo,pg_catalog.round(e.dist)::integer,
 e.platform,e.md,coalesce(e.ln,array[]::text[]),e.cnt
from eligible e order by e.dist,e.src,e.sid
limit (select n from cfg) offset (select sk from cfg)
$fn$;
revoke all on function public.transit_next_diagnostic_nearby_page(text,double precision,double precision,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.transit_next_diagnostic_nearby_page(text,double precision,double precision,integer,integer,integer) to service_role;
