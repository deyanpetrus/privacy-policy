-- NEXT only. Small sourced ROUTE DIRECTORY, NOT a timetable, NOT a GPS/stop export.
-- Safely reference public city-operated source names; no replicated operator schedule tables.
-- Historical 2025 Strumica routes MUST NOT be shown as CURRENT before updated 2026 ordinance review.
CREATE TABLE IF NOT EXISTS transit_next.mk_static_route_catalog (
 route_key text PRIMARY KEY,
 city text NOT NULL CHECK (city in ('Штип','Струмица')),
 operator_name text NOT NULL,
 route_short_name text NOT NULL,
 route_long_name text NOT NULL,
 published_stop_count integer CHECK (published_stop_count IS NULL OR published_stop_count BETWEEN 0 AND 300),
 data_status text NOT NULL CHECK (data_status in ('route_only','historic_unverified','verified_scheduled')),
 source_url text NOT NULL,
 source_reviewed_on date NOT NULL,
 transport_mode text NOT NULL DEFAULT 'bus' CHECK (transport_mode='bus'),
 quality_label text NOT NULL DEFAULT 'CACHED ROUTE LIST · NOT LIVE',
 has_verified_current_departures boolean NOT NULL DEFAULT false CHECK (has_verified_current_departures=false),
 added_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE transit_next.mk_static_route_catalog ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON transit_next.mk_static_route_catalog FROM public,anon,authenticated;
GRANT SELECT ON transit_next.mk_static_route_catalog TO service_role;
-- No UPDATE for service_role: new reviewed data via audited migration only.
INSERT INTO transit_next.mk_static_route_catalog
(route_key,city,operator_name,route_short_name,route_long_name,published_stop_count,
 data_status,source_url,source_reviewed_on)
VALUES
('MK-ST-L1','Штип','Јавен превоз Штип','1','Трговски центар – Стар Караорман – Трговски центар',9,'route_only','https://jps.mk/route/1','2026-11-15'::date),
('MK-ST-L1.1','Штип','Јавен превоз Штип','1.1','Трговски центар – Стар Караорман – Дузлак – Трговски центар',10,'route_only','https://jps.mk/route/1.1','2026-11-15'::date),
('MK-ST-L2.1','Штип','Јавен превоз Штип','2.1','Трговски центар – Баби – Трговски центар',9,'route_only','https://jps.mk/route/2.1','2026-11-15'::date),
('MK-ST-L2.2','Штип','Јавен превоз Штип','2.2','Трговски центар – Баби – Трговски центар',9,'route_only','https://jps.mk/route/2.2','2026-11-15'::date),
('MK-ST-L2.3','Штип','Јавен превоз Штип','2.3','Дузлак – Баби – Бања „Жековица“',11,'route_only','https://jps.mk/route/2.3','2026-11-15'::date),
('MK-ST-L3','Штип','Јавен превоз Штип','3','Трговски центар – Три Чешми – Чардаклија – Трговски центар',9,'route_only','https://jps.mk/','2026-11-15'::date),
('MK-ST-L3.1','Штип','Јавен превоз Штип','3.1','Трговски центар – Три Чешми – Чардаклија – Трговски центар',8,'route_only','https://jps.mk/','2026-11-15'::date),
('MK-ST-L4','Штип','Јавен превоз Штип','4','Трговски центар – Дузлак – Трговски центар',8,'route_only','https://jps.mk/route/4','2026-11-15'::date),
('MK-ST-L5','Штип','Јавен превоз Штип','5','Ново Село – ООУ Ванчо Прке – Ново Село',3,'route_only','https://jps.mk/route/5','2026-11-15'::date),
('MK-ST-L6','Штип','Јавен превоз Штип','6','Трговски центар – Лакавица – Селце – Трговски центар',11,'route_only','https://jps.mk/','2026-11-15'::date),
('MK-ST-L7','Штип','Јавен превоз Штип','7','Трговски центар – Радање – Трговски центар',14,'route_only','https://jps.mk/','2026-11-15'::date),
('MK-ST-L7.1','Штип','Јавен превоз Штип','7.1','Трговски центар – Радање – Трговски центар',18,'route_only','https://jps.mk/route/7.1','2026-11-15'::date),
('MK-ST-L8','Штип','Јавен превоз Штип','8','Трговски центар – Кучица – Трговски центар',21,'route_only','https://jps.mk/route/8','2026-11-15'::date),
('MK-ST-L9','Штип','Јавен превоз Штип','9','Трговски центар – Долни Балван – Радање – Трговски центар',15,'route_only','https://jps.mk/','2026-11-15'::date),
('MK-SR-2025-L2','Струмица','ЈСП Струмица-Транспорт','2','Струмица – Просениково – Добрејци – Струмица',NULL,'historic_unverified','https://strumica.gov.mk/wp-content/uploads/2025/04/4.Sl_.-glasnik-br.-4-25.pdf','2026-11-15'::date),
('MK-SR-2025-L8','Струмица','ЈСП Струмица-Транспорт','8','Градска кружна линија – 2',NULL,'historic_unverified','https://strumica.gov.mk/wp-content/uploads/2025/04/4.Sl_.-glasnik-br.-4-25.pdf','2026-11-15'::date)
ON CONFLICT (route_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.transit_mk_static_route_catalog(
 p_city text DEFAULT NULL, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0
)
RETURNS TABLE (
 route_key text, city text, operator_name text,
 route_short_name text, route_long_name text, published_stop_count integer,
 data_status text, source_url text, source_reviewed_on date,
 transport_mode text, quality_label text,
 has_verified_current_departures boolean, total_matches bigint
)
LANGUAGE SQL STABLE SECURITY INVOKER SET search_path TO ''
AS $fn$
SELECT r.route_key,r.city,r.operator_name,r.route_short_name,r.route_long_name,
 r.published_stop_count,r.data_status,r.source_url,r.source_reviewed_on,
 r.transport_mode,r.quality_label,r.has_verified_current_departures,
 count(*) over() AS total_matches
FROM transit_next.mk_static_route_catalog r
WHERE p_city IS NULL OR p_city='' OR r.city=p_city
ORDER BY r.city,r.route_short_name,r.route_key
LIMIT least(100,greatest(1,coalesce(p_limit,100)))
OFFSET least(10000,greatest(0,coalesce(p_offset,0)))
$fn$;
REVOKE ALL ON FUNCTION public.transit_mk_static_route_catalog(text,integer,integer) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.transit_mk_static_route_catalog(text,integer,integer) TO service_role;
