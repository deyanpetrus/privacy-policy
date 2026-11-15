-- LifeDashPro NEXT Unified Transit Engine v4, dedicated Transit project only.
-- Atomic cache quality gate. Reuses existing private table, does not touch live GTFS.
create or replace function public.transit_shared_cache_store_quality_v2(
  p_bucket text, p_key text, p_payload jsonb, p_ttl_seconds integer,
  p_provider text, p_quality_score integer, p_stale_grace_seconds integer default 0
) returns boolean
language plpgsql security invoker set search_path to ''
as $function$
declare
 n integer;
 max_ttl integer;
 max_stale integer;
 affected integer;
begin
 if p_bucket not in ('nearby','departures','trip') or
    p_key is null or p_key !~ '^[0-9a-f]{64}$' or
    p_payload is null or jsonb_typeof(p_payload)<>'object' or
    p_payload->>'ok'<>'true' or
    p_quality_score is null or p_quality_score < 1 or p_quality_score > 100
 then return false; end if;
 max_ttl:=case p_bucket when 'nearby' then 86400 when 'departures' then 60 when 'trip' then 21600 else 0 end;
 max_stale:=case when p_bucket='nearby' then 21600 else 0 end;
 if p_ttl_seconds is null or p_ttl_seconds < 5 or p_ttl_seconds > max_ttl or
    p_stale_grace_seconds is null or p_stale_grace_seconds < 0 or p_stale_grace_seconds > max_stale
 then return false; end if;
 if (p_bucket='nearby' and (jsonb_typeof(p_payload->'stops') <> 'array' or jsonb_array_length(p_payload->'stops')=0)) or
    (p_bucket='departures' and (jsonb_typeof(p_payload->'departures') <> 'array' or jsonb_array_length(p_payload->'departures')=0)) or
    (p_bucket='trip' and jsonb_typeof(p_payload->'route') <> 'object')
 then return false; end if;
 n:=octet_length(p_payload::text);
 if n<2 or n>65536 then return false; end if;
 if pg_database_size(current_database()) >= 340*1048576 or
    pg_total_relation_size('transit_next.shared_lookup_cache_v1'::regclass) >= 20*1048576
 then return false; end if;
 insert into transit_next.shared_lookup_cache_v1
   (bucket,cache_key,payload,payload_bytes,provider,stored_at,expires_at,stale_until)
 values
   (p_bucket,p_key,jsonb_set(p_payload,'{qualityScore}',to_jsonb(p_quality_score),true),
    n,left(coalesce(p_provider,'unknown'),80),now(),
    now()+make_interval(secs=>p_ttl_seconds),
    now()+make_interval(secs=>p_ttl_seconds+p_stale_grace_seconds))
 on conflict (bucket,cache_key) do update set
   payload=excluded.payload,payload_bytes=excluded.payload_bytes,provider=excluded.provider,
   stored_at=excluded.stored_at,expires_at=excluded.expires_at,stale_until=excluded.stale_until
 where transit_next.shared_lookup_cache_v1.expires_at<=now()
    or p_quality_score>=(
       case when (transit_next.shared_lookup_cache_v1.payload->>'qualityScore') ~ '^[0-9]{1,3}$'
            then (transit_next.shared_lookup_cache_v1.payload->>'qualityScore')::integer
            else 0 end);
 get diagnostics affected=row_count;
 return affected=1;
end
$function$;
revoke all on function public.transit_shared_cache_store_quality_v2(text,text,jsonb,integer,text,integer,integer) from public,anon,authenticated;
grant execute on function public.transit_shared_cache_store_quality_v2(text,text,jsonb,integer,text,integer,integer) to service_role;
comment on function public.transit_shared_cache_store_quality_v2(text,text,jsonb,integer,text,integer,integer) is
  'NEXT v4 only: service role/private atomic non-worsening cache writes, 64 KiB payload, 20 MiB cache and 340 MiB DB guards, no personal data.';
