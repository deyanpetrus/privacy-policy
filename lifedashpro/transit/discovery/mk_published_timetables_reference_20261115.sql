-- LifeDashPro NEXT MK static PUBLISHED TIMES. No claim of current valid service, no licensed GTFS import.
-- Terminal-level, source cited, conditionally published. Not allowed as confirmed date-specific trips.
create table if not exists transit_next.mk_published_schedule_reference (
 reference_id text primary key,
 service_class text not null check(service_class in ('local_bus','intercity_bus')),
 catalog_city text not null,
 operator_name text not null,
 route_key text,
 origin text not null,
 destination text not null,
 departure_time time without time zone not null,
 service_rule text not null check(service_rule in ('school_weekdays','workdays','except_sunday','not_specified')),
 source_status text not null check(source_status in ('published_conditional','published_undated')),
 source_url text not null,
 source_note text not null,
 checked_on date not null default current_date,
 school_calendar_verified boolean not null default false,
 current_service_validity_verified boolean not null default false,
 eligible_for_journey boolean not null default false,
 data_label text not null default 'CACHED PUBLISHED TIME · NOT LIVE',
 constraint mk_no_unverified_journeys check (
   not eligible_for_journey or current_service_validity_verified
 ),
 constraint mk_school_guard check(
   service_rule<>'school_weekdays' or not eligible_for_journey or school_calendar_verified
 )
);
create index if not exists mk_schedules_city_type on transit_next.mk_published_schedule_reference (catalog_city,service_class,origin,destination,departure_time);
alter table transit_next.mk_published_schedule_reference enable row level security;
revoke all on transit_next.mk_published_schedule_reference from public,anon,authenticated;
grant select on transit_next.mk_published_schedule_reference to service_role;
insert into transit_next.mk_published_schedule_reference (
reference_id,service_class,catalog_city,operator_name,route_key,origin,destination,departure_time,service_rule,source_status,source_url,source_note
) values
('MK-ST-L1:Трговски центар:08:00','local_bus','Штип','Јавен превоз Штип','MK-ST-L1','Трговски центар','Стар Караорман','08:00','school_weekdays','published_conditional','https://jps.mk/route/1','School-year Monday-Friday, first stop departure as published'),
('MK-ST-L2.2:Трговски центар:06:45','local_bus','Штип','Јавен превоз Штип','MK-ST-L2.2','Трговски центар','Баби','06:45','school_weekdays','published_conditional','https://jps.mk/route/2.2','School-year Monday-Friday; first listed terminal time'),
('MK-ST-L2.3:Дузлак (Ул. Драги Крупишки):06:55','local_bus','Штип','Јавен превоз Штип','MK-ST-L2.3','Дузлак (Ул. Драги Крупишки)','Бања Жековица','06:55','school_weekdays','published_conditional','https://jps.mk/route/2.3','Weekday school-year trip only; site separately describes Saturday/public holiday exceptions'),
('MK-ST-L4:Трговски центар:12:20','local_bus','Штип','Јавен превоз Штип','MK-ST-L4','Трговски центар','Дузлак','12:20','school_weekdays','published_conditional','https://jps.mk/route/4','School-year Monday-Friday; origin station'),
('MK-ST-L7.1:Трговски центар:06:00','local_bus','Штип','Јавен превоз Штип','MK-ST-L7.1','Трговски центар','Карбинци','06:00','school_weekdays','published_conditional','https://jps.mk/route/7.1','School-year Monday-Friday; origin station'),
('MK-ST-L8:Трговски центар:13:45','local_bus','Штип','Јавен превоз Штип','MK-ST-L8','Трговски центар','Кучица','13:45','school_weekdays','published_conditional','https://jps.mk/route/8','School-year Monday-Friday; origin-only activation 13:45'),
('MK-ST-L8:Трговски центар:19:40','local_bus','Штип','Јавен превоз Штип','MK-ST-L8','Трговски центар','Кучица','19:40','school_weekdays','published_conditional','https://jps.mk/route/8','School-year Monday-Friday; origin-only activation 19:40'),
('MK-INTERCITY:Струмица:Скопје:03:30','intercity_bus','Струмица','Струмица Експрес','','Струмица','Скопје','03:30','workdays','published_undated','https://strumica.gov.mk/%D1%81%D0%BE%D0%BE%D0%B1%D1%80%D0%B0%D1%9C%D0%B0%D1%98/','municipality states workdays'),
('MK-INTERCITY:Струмица:Скопје:05:00','intercity_bus','Струмица','Струмица Експрес','','Струмица','Скопје','05:00','not_specified','published_undated','https://strumica.gov.mk/%D1%81%D0%BE%D0%BE%D0%B1%D1%80%D0%B0%D1%9C%D0%B0%D1%98/','Municipal page is undated; current validity cannot be guaranteed'),
('MK-INTERCITY:Струмица:Скопје:05:15','intercity_bus','Струмица','Струмица Експрес','','Струмица','Скопје','05:15','not_specified','published_undated','https://strumica.gov.mk/%D1%81%D0%BE%D0%BE%D0%B1%D1%80%D0%B0%D1%9C%D0%B0%D1%98/','via Negotino'),
('MK-INTERCITY:Струмица:Скопје:06:00','intercity_bus','Струмица','Струмица Експрес','','Струмица','Скопје','06:00','workdays','published_undated','https://strumica.gov.mk/%D1%81%D0%BE%D0%BE%D0%B1%D1%80%D0%B0%D1%9C%D0%B0%D1%98/','municipality states workdays'),
('MK-INTERCITY:Струмица:Скопје:06:30','intercity_bus','Струмица','Струмица Експрес','','Струмица','Скопје','06:30','not_specified','published_undated','https://strumica.gov.mk/%D1%81%D0%BE%D0%BE%D0%B1%D1%80%D0%B0%D1%9C%D0%B0%D1%98/','Municipal page is undated; current validity cannot be guaranteed'),
('MK-INTERCITY:Струмица:Скопје:08:30','intercity_bus','Струмица','Струмица Експрес','','Струмица','Скопје','08:30','workdays','published_undated','https://strumica.gov.mk/%D1%81%D0%BE%D0%BE%D0%B1%D1%80%D0%B0%D1%9C%D0%B0%D1%98/','municipality states workdays'),
('MK-INTERCITY:Струмица:Скопје:09:30','intercity_bus','Струмица','Струмица Експрес','','Струмица','Скопје','09:30','not_specified','published_undated','https://strumica.gov.mk/%D1%81%D0%BE%D0%BE%D0%B1%D1%80%D0%B0%D1%9C%D0%B0%D1%98/','Municipal page is undated; current validity cannot be guaranteed'),
('MK-INTERCITY:Струмица:Скопје:11:30','intercity_bus','Струмица','Струмица Експрес','','Струмица','Скопје','11:30','not_specified','published_undated','https://strumica.gov.mk/%D1%81%D0%BE%D0%BE%D0%B1%D1%80%D0%B0%D1%9C%D0%B0%D1%98/','Municipal page is undated; current validity cannot be guaranteed'),
('MK-INTERCITY:Струмица:Скопје:13:30','intercity_bus','Струмица','Струмица Експрес','','Струмица','Скопје','13:30','not_specified','published_undated','https://strumica.gov.mk/%D1%81%D0%BE%D0%BE%D0%B1%D1%80%D0%B0%D1%9C%D0%B0%D1%98/','Municipal page is undated; current validity cannot be guaranteed'),
('MK-INTERCITY:Струмица:Скопје:15:30','intercity_bus','Струмица','Струмица Експрес','','Струмица','Скопје','15:30','not_specified','published_undated','https://strumica.gov.mk/%D1%81%D0%BE%D0%BE%D0%B1%D1%80%D0%B0%D1%9C%D0%B0%D1%98/','Municipal page is undated; current validity cannot be guaranteed'),
('MK-INTERCITY:Струмица:Битола:06:00','intercity_bus','Струмица','Струмица Експрес','','Струмица','Битола','06:00','not_specified','published_undated','https://strumica.gov.mk/%D1%81%D0%BE%D0%BE%D0%B1%D1%80%D0%B0%D1%9C%D0%B0%D1%98/','Municipal page is undated; current validity cannot be guaranteed'),
('MK-INTERCITY:Струмица:Гевгелија:06:30','intercity_bus','Струмица','Струмица Експрес','','Струмица','Гевгелија','06:30','not_specified','published_undated','https://strumica.gov.mk/%D1%81%D0%BE%D0%BE%D0%B1%D1%80%D0%B0%D1%9C%D0%B0%D1%98/','Municipal page is undated; current validity cannot be guaranteed'),
('MK-INTERCITY:Струмица:Гевгелија:13:00','intercity_bus','Струмица','Струмица Експрес','','Струмица','Гевгелија','13:00','not_specified','published_undated','https://strumica.gov.mk/%D1%81%D0%BE%D0%BE%D0%B1%D1%80%D0%B0%D1%9C%D0%B0%D1%98/','Municipal page is undated; current validity cannot be guaranteed'),
('MK-INTERCITY:Струмица:Софија:03:00','intercity_bus','Струмица','Струмица Експрес','','Струмица','Софија','03:00','except_sunday','published_undated','https://strumica.gov.mk/%D1%81%D0%BE%D0%BE%D0%B1%D1%80%D0%B0%D1%9C%D0%B0%D1%98/','Municipal page is undated; current validity cannot be guaranteed'),
('MK-INTERCITY:Скопје:Струмица:10:00','intercity_bus','Струмица','Струмица Експрес','','Скопје','Струмица','10:00','not_specified','published_undated','https://strumica.gov.mk/%D1%81%D0%BE%D0%BE%D0%B1%D1%80%D0%B0%D1%9C%D0%B0%D1%98/','Municipal page is undated; current validity cannot be guaranteed'),
('MK-INTERCITY:Скопје:Струмица:13:00','intercity_bus','Струмица','Струмица Експрес','','Скопје','Струмица','13:00','not_specified','published_undated','https://strumica.gov.mk/%D1%81%D0%BE%D0%BE%D0%B1%D1%80%D0%B0%D1%9C%D0%B0%D1%98/','via Negotino'),
('MK-INTERCITY:Скопје:Струмица:14:00','intercity_bus','Струмица','Струмица Експрес','','Скопје','Струмица','14:00','not_specified','published_undated','https://strumica.gov.mk/%D1%81%D0%BE%D0%BE%D0%B1%D1%80%D0%B0%D1%9C%D0%B0%D1%98/','Municipal page is undated; current validity cannot be guaranteed'),
('MK-INTERCITY:Скопје:Струмица:14:30','intercity_bus','Струмица','Струмица Експрес','','Скопје','Струмица','14:30','not_specified','published_undated','https://strumica.gov.mk/%D1%81%D0%BE%D0%BE%D0%B1%D1%80%D0%B0%D1%9C%D0%B0%D1%98/','Municipal page is undated; current validity cannot be guaranteed'),
('MK-INTERCITY:Скопје:Струмица:15:00','intercity_bus','Струмица','Струмица Експрес','','Скопје','Струмица','15:00','workdays','published_undated','https://strumica.gov.mk/%D1%81%D0%BE%D0%BE%D0%B1%D1%80%D0%B0%D1%9C%D0%B0%D1%98/','municipality states workdays'),
('MK-INTERCITY:Скопје:Струмица:15:30','intercity_bus','Струмица','Струмица Експрес','','Скопје','Струмица','15:30','not_specified','published_undated','https://strumica.gov.mk/%D1%81%D0%BE%D0%BE%D0%B1%D1%80%D0%B0%D1%9C%D0%B0%D1%98/','Municipal page is undated; current validity cannot be guaranteed'),
('MK-INTERCITY:Скопје:Струмица:16:00','intercity_bus','Струмица','Струмица Експрес','','Скопје','Струмица','16:00','not_specified','published_undated','https://strumica.gov.mk/%D1%81%D0%BE%D0%BE%D0%B1%D1%80%D0%B0%D1%9C%D0%B0%D1%98/','Municipal page is undated; current validity cannot be guaranteed'),
('MK-INTERCITY:Скопје:Струмица:17:00','intercity_bus','Струмица','Струмица Експрес','','Скопје','Струмица','17:00','not_specified','published_undated','https://strumica.gov.mk/%D1%81%D0%BE%D0%BE%D0%B1%D1%80%D0%B0%D1%9C%D0%B0%D1%98/','Municipal page is undated; current validity cannot be guaranteed'),
('MK-INTERCITY:Скопје:Струмица:18:00','intercity_bus','Струмица','Струмица Експрес','','Скопје','Струмица','18:00','not_specified','published_undated','https://strumica.gov.mk/%D1%81%D0%BE%D0%BE%D0%B1%D1%80%D0%B0%D1%9C%D0%B0%D1%98/','Municipal page is undated; current validity cannot be guaranteed'),
('MK-INTERCITY:Скопје:Струмица:19:00','intercity_bus','Струмица','Струмица Експрес','','Скопје','Струмица','19:00','not_specified','published_undated','https://strumica.gov.mk/%D1%81%D0%BE%D0%BE%D0%B1%D1%80%D0%B0%D1%9C%D0%B0%D1%98/','Municipal page is undated; current validity cannot be guaranteed'),
('MK-INTERCITY:Битола:Струмица:14:15','intercity_bus','Струмица','Струмица Експрес','','Битола','Струмица','14:15','not_specified','published_undated','https://strumica.gov.mk/%D1%81%D0%BE%D0%BE%D0%B1%D1%80%D0%B0%D1%9C%D0%B0%D1%98/','Municipal page is undated; current validity cannot be guaranteed'),
('MK-INTERCITY:Гевгелија:Струмица:10:30','intercity_bus','Струмица','Струмица Експрес','','Гевгелија','Струмица','10:30','not_specified','published_undated','https://strumica.gov.mk/%D1%81%D0%BE%D0%BE%D0%B1%D1%80%D0%B0%D1%9C%D0%B0%D1%98/','Municipal page is undated; current validity cannot be guaranteed'),
('MK-INTERCITY:Гевгелија:Струмица:17:00','intercity_bus','Струмица','Струмица Експрес','','Гевгелија','Струмица','17:00','not_specified','published_undated','https://strumica.gov.mk/%D1%81%D0%BE%D0%BE%D0%B1%D1%80%D0%B0%D1%9C%D0%B0%D1%98/','Municipal page is undated; current validity cannot be guaranteed'),
('MK-INTERCITY:Софија:Струмица:14:15','intercity_bus','Струмица','Струмица Експрес','','Софија','Струмица','14:15','not_specified','published_undated','https://strumica.gov.mk/%D1%81%D0%BE%D0%BE%D0%B1%D1%80%D0%B0%D1%9C%D0%B0%D1%98/','Municipal page is undated; current validity cannot be guaranteed')
on conflict (reference_id) do nothing;

create or replace function public.transit_mk_published_departure_reference_search(
 p_origin text default null,p_destination text default null,p_city text default null,
 p_service_class text default null,p_limit integer default 100,p_offset integer default 0
) returns table (
 reference_id text,service_class text,catalog_city text,operator_name text,route_key text,
 origin text,destination text,departure_time text,service_rule text,source_status text,
 source_url text,source_note text,checked_on date,school_calendar_verified boolean,
 current_service_validity_verified boolean,eligible_for_journey boolean,data_label text,
 total_matches bigint
) language sql stable security invoker set search_path to ''
as $fn$
 select x.reference_id,x.service_class,x.catalog_city,x.operator_name,x.route_key,
 x.origin,x.destination,to_char(x.departure_time,'HH24:MI')::text,
 x.service_rule,x.source_status,x.source_url,x.source_note,x.checked_on,
 x.school_calendar_verified,x.current_service_validity_verified,x.eligible_for_journey,x.data_label,
 count(*) over() as total_matches
 from transit_next.mk_published_schedule_reference x
 where (p_origin is null or p_origin='' or x.origin ilike ('%'||p_origin||'%'))
   and (p_destination is null or p_destination='' or x.destination ilike ('%'||p_destination||'%'))
   and (p_city is null or p_city='' or x.catalog_city=p_city)
   and (p_service_class is null or p_service_class='' or x.service_class=p_service_class)
 order by x.catalog_city,x.service_class,x.origin,x.destination,x.departure_time
 limit least(100,greatest(1,coalesce(p_limit,100)))
 offset least(10000,greatest(0,coalesce(p_offset,0)))
$fn$;
revoke all on function public.transit_mk_published_departure_reference_search(text,text,text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.transit_mk_published_departure_reference_search(text,text,text,text,integer,integer) to service_role;