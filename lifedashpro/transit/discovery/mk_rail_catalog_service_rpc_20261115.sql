-- LifeDashPro NEXT: READ ONLY rail route summary, no service timetable overwrite.
-- Keep community timetable verified through 2026-12-12; label NOT LIVE.
GRANT SELECT ON transit_next.mk_rail_import_meta, transit_next.mk_rail_routes TO service_role;
CREATE OR REPLACE FUNCTION public.transit_mk_rail_route_catalog()
RETURNS TABLE (
 route_id text, route_short_name text, route_long_name text, transport_mode text,
 provider text, quality_label text, source_reviewed_until date, source_valid_until date,
 original_feed text, timetable_status text
)
LANGUAGE SQL STABLE SECURITY INVOKER SET search_path TO ''
AS $fn$
SELECT r.route_id,r.route_short_name,r.route_long_name,'train'::text,
 'Македонски Железници / community GTFS'::text,
 'CACHED RAIL ROUTE · NOT LIVE'::text,m.service_verified_until,m.source_valid_until,
 m.feed_id,
 CASE WHEN m.status='enabled' AND m.service_verified_until >= current_date
      THEN 'VERIFIED_REFERENCE_WINDOW'
      ELSE 'TIMETABLE_NEEDS_REVERIFICATION' END
FROM transit_next.mk_rail_routes r CROSS JOIN transit_next.mk_rail_import_meta m
WHERE m.feed_id='mk-rail-community' AND m.status='enabled'
ORDER BY r.route_short_name
$fn$;
REVOKE ALL ON FUNCTION public.transit_mk_rail_route_catalog() FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.transit_mk_rail_route_catalog() TO service_role;
