-- LifeDashPro NEXT: bounded shared Transit lookup cache, service-only, separate from live GTFS.
-- No personal names, emails, exact GPS, tokens, searches or user IDs.
create table if not exists transit_next.shared_lookup_cache_v1 (
  bucket text not null check (bucket in ('nearby','departures','trip')),
  cache_key text not null check (cache_key ~ '^[0-9a-f]{64}$'),
  payload jsonb not null,
  payload_bytes integer not null check (payload_bytes between 2 and 65536),
  provider text not null default 'unknown',
  stored_at timestamptz not null default now(),
  expires_at timestamptz not null,
  stale_until timestamptz not null,
  primary key (bucket, cache_key),
  constraint cache_expiry_order check(stale_until >= expires_at)
);
create index if not exists shared_lookup_cache_expiry_idx
  on transit_next.shared_lookup_cache_v1(stale_until);
alter table transit_next.shared_lookup_cache_v1 enable row level security;
revoke all on transit_next.shared_lookup_cache_v1 from public, anon, authenticated;
grant select, insert, update, delete on transit_next.shared_lookup_cache_v1 to service_role;

create or replace function public.transit_shared_cache_read_v1(p_bucket text, p_key text)
returns table (payload jsonb, provider text, stored_at timestamptz, expires_at timestamptz, is_fresh boolean)
language sql stable security invoker set search_path to ''
as $$
  select c.payload,c.provider,c.stored_at,c.expires_at,(c.expires_at>now())
  from transit_next.shared_lookup_cache_v1 c
  where c.bucket=p_bucket and c.cache_key=p_key and c.stale_until>now()
  limit 1;
$$;
revoke all on function public.transit_shared_cache_read_v1(text,text) from public,anon,authenticated;
grant execute on function public.transit_shared_cache_read_v1(text,text) to service_role;

create or replace function public.transit_shared_cache_store_v1(
  p_bucket text,p_key text,p_payload jsonb,p_ttl_seconds integer,p_provider text default 'unknown',
  p_stale_grace_seconds integer default 0
) returns boolean
language plpgsql security invoker set search_path to ''
as $$
declare
  n integer;
  max_ttl integer;
begin
  if p_bucket not in ('nearby','departures','trip') or
     p_key !~ '^[0-9a-f]{64}$' or
     p_payload is null or jsonb_typeof(p_payload)<>'object' or
     p_payload->>'ok'<>'true' then
    return false;
  end if;
  max_ttl:=case p_bucket when 'nearby' then 86400 when 'trip' then 21600 when 'departures' then 60 else 0 end;
  if p_ttl_seconds < 5 or p_ttl_seconds > max_ttl
     or p_stale_grace_seconds < 0 or
     p_stale_grace_seconds > case when p_bucket='nearby' then 21600 else 0 end then
    return false;
  end if;
  if (p_bucket='nearby' and (jsonb_typeof(p_payload->'stops')<>'array' or jsonb_array_length(p_payload->'stops')=0))
    or (p_bucket='departures' and (jsonb_typeof(p_payload->'departures')<>'array' or jsonb_array_length(p_payload->'departures')=0))
    or (p_bucket='trip' and jsonb_typeof(p_payload->'route')<>'object')
  then return false;
  end if;
  n:=octet_length(p_payload::text);
  if n<2 or n>65536 then return false; end if;
  -- Main app DB is ~345 MB; cache goes to dedicated ~209 MB project with protective upper bounds.
  if pg_database_size(current_database()) >= 340*1048576
     or pg_total_relation_size('transit_next.shared_lookup_cache_v1'::regclass) >= 20*1048576 then
    return false;
  end if;
  insert into transit_next.shared_lookup_cache_v1
    (bucket,cache_key,payload,payload_bytes,provider,stored_at,expires_at,stale_until)
  values
    (p_bucket,p_key,p_payload,n,left(coalesce(p_provider,'unknown'),80),now(),
      now()+make_interval(secs=>p_ttl_seconds),
      now()+make_interval(secs=>p_ttl_seconds+p_stale_grace_seconds))
  on conflict (bucket,cache_key) do update set
    payload=excluded.payload,payload_bytes=excluded.payload_bytes,
    provider=excluded.provider,stored_at=now(),
    expires_at=excluded.expires_at,stale_until=excluded.stale_until;
  return true;
end;
$$;
revoke all on function public.transit_shared_cache_store_v1(text,text,jsonb,integer,text,integer) from public,anon,authenticated;
grant execute on function public.transit_shared_cache_store_v1(text,text,jsonb,integer,text,integer) to service_role;

create or replace function public.transit_shared_cache_prune_v1(p_limit integer default 400)
returns integer
language plpgsql security invoker set search_path to ''
as $$
declare n integer;
begin
  with victims as (
    select ctid from transit_next.shared_lookup_cache_v1
    where stale_until<=now()
    order by stale_until
    limit least(greatest(coalesce(p_limit,400),1),1000)
  ), deleted as (
    delete from transit_next.shared_lookup_cache_v1 c
    where c.ctid in (select ctid from victims) returning 1
  )
  select count(*)::integer into n from deleted;
  return n;
end;
$$;
revoke all on function public.transit_shared_cache_prune_v1(integer) from public,anon,authenticated;
grant execute on function public.transit_shared_cache_prune_v1(integer) to service_role;

create or replace function public.transit_shared_cache_stats_v1()
returns table(bucket text,items bigint,relation_bytes bigint,oldest timestamptz,newest timestamptz)
language sql stable security invoker set search_path to ''
as $$
  select bucket,count(*)::bigint,
    pg_total_relation_size('transit_next.shared_lookup_cache_v1'::regclass),
    min(stored_at),max(stored_at)
  from transit_next.shared_lookup_cache_v1
  group by bucket order by bucket
$$;
revoke all on function public.transit_shared_cache_stats_v1() from public,anon,authenticated;
grant execute on function public.transit_shared_cache_stats_v1() to service_role;

comment on table transit_next.shared_lookup_cache_v1 is
  'NEXT only, private server-side shared transit results; never user profiles, precise GPS, API credentials, emergencies, or 24-hour realtime. TTL, 20MiB table and 340MiB database guards.';
