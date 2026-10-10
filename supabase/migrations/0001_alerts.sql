-- AidNow neighbor alerts.
-- Run once in the Supabase SQL editor (Dashboard -> SQL Editor -> New query -> paste -> Run).
--
-- Privacy: an alert holds only the kind of problem, how serious it is, an area about 1 km wide and the minute it
-- was posted. The phone that posted it is stored only as a hash, to limit how often one phone can post.
-- The anon key shipped in the app has NO direct access to the table: it can only call the two functions below,
-- which validate, round and rate-limit everything.

create table if not exists public.alerts (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default date_trunc('minute', now()),
  situation   text not null check (situation in (
                'water_in_home','injury_trapped','fire_gas','generator_fumes','downed_line',
                'medical_device','power_outage','street_hazard','need_shelter','need_supplies','other')),
  urgency     text not null check (urgency in ('emergency','urgent_safety')),
  lat         double precision not null check (lat between 24 and 27),    -- Miami-Dade area
  lon         double precision not null check (lon between -82 and -79),
  device_hash text not null
);

create index if not exists alerts_created_at_idx on public.alerts (created_at desc);
create index if not exists alerts_device_idx on public.alerts (device_hash, created_at desc);

-- Row level security on, and no policies: the anon and authenticated roles cannot read or write rows directly.
alter table public.alerts enable row level security;
revoke all on public.alerts from anon, authenticated;

-- Alerts older than this are never returned (and can be deleted by the cleanup below).
create or replace function public.alert_ttl() returns interval language sql immutable as $$ select interval '6 hours' $$;

-- Distance in km between two points (haversine).
create or replace function public.km_between(lat1 double precision, lon1 double precision, lat2 double precision, lon2 double precision)
returns double precision language sql immutable as $$
  select 2 * 6371 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lon2 - lon1) / 2), 2)))
$$;

-- Post an alert. Rounds the location to ~1 km (0.01 degree) no matter what the phone sent,
-- and allows at most 3 alerts per phone per hour.
create or replace function public.post_alert(
  p_situation text, p_urgency text, p_lat double precision, p_lon double precision, p_device text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_hash text := md5(coalesce(p_device, ''));
  v_id uuid;
begin
  if p_device is null or length(p_device) < 8 then
    raise exception 'bad_request: device';
  end if;
  if (select count(*) from alerts where device_hash = v_hash and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'rate_limited';
  end if;
  insert into alerts (situation, urgency, lat, lon, device_hash)
  values (p_situation, p_urgency, round(p_lat::numeric, 2), round(p_lon::numeric, 2), v_hash)
  returning id into v_id;
  return v_id;
end $$;

-- Alerts that reach this point: emergency within 5 km, urgent within 2 km, not older than the TTL.
-- Keep these radii in step with ALERT_RADIUS_KM in src/core/alerts.ts.
create or replace function public.nearby_alerts(p_lat double precision, p_lon double precision, p_device text default '')
returns table (id uuid, created_at timestamptz, situation text, urgency text, lat double precision, lon double precision, mine boolean)
language sql stable security definer set search_path = public as $$
  select a.id, a.created_at, a.situation, a.urgency, a.lat, a.lon, (a.device_hash = md5(coalesce(p_device, ''))) as mine
  from alerts a
  where a.created_at > now() - alert_ttl()
    and km_between(p_lat, p_lon, a.lat, a.lon) <= case a.urgency when 'emergency' then 5 else 2 end
  order by a.created_at desc
  limit 50
$$;

revoke all on function public.post_alert(text, text, double precision, double precision, text) from public;
revoke all on function public.nearby_alerts(double precision, double precision, text) from public;
grant execute on function public.post_alert(text, text, double precision, double precision, text) to anon;
grant execute on function public.nearby_alerts(double precision, double precision, text) to anon;

-- Optional cleanup of expired alerts (needs the pg_cron extension: Dashboard -> Database -> Extensions).
-- select cron.schedule('aidnow-alert-cleanup', '*/30 * * * *', $$ delete from public.alerts where created_at < now() - interval '1 day' $$);
