-- AO — Gizlilik talepleri (CCPA): bir işletme sahibinin ya da restoranı arayan
-- bir müşterinin /privacy formundan gönderdiği silme / verilerimi görmek
-- talepleri. Otomatik silme yok; amaç talebin kaybolmaması ve adminin
-- /admin/gizlilik-talepleri kuyruğunda 45 günlük yasal süre içinde yanıtlaması.
--
-- Form anonim ziyaretçiden gelir ama tabloya doğrudan yazamaz: server action
-- doğrulayıp servis rolüyle ekler (rate limit + honeypot onun önünde).
-- Okuma/güncelleme yalnızca admin (is_admin()).

create table if not exists public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  request_type text not null check (request_type in ('delete', 'access')),
  requester_type text not null check (requester_type in ('merchant', 'caller', 'other')),
  full_name text not null check (char_length(trim(full_name)) between 1 and 120),
  email text not null check (char_length(email) between 3 and 254),
  -- Arayan müşteri için verisini bulmamızı sağlayan numara ve aradığı restoran.
  phone text check (phone is null or char_length(phone) <= 32),
  business_name text check (business_name is null or char_length(business_name) <= 160),
  details text check (details is null or char_length(details) <= 2000),
  status text not null default 'new' check (status in ('new', 'in_progress', 'completed', 'rejected')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 2000),
  created_at timestamptz not null default now(),
  -- CCPA: 45 gün içinde yanıt (bir kez 45 gün uzatılabilir, gerekçesiyle bildirilerek).
  due_at timestamptz not null default (now() + interval '45 days'),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_privacy_requests_open
  on public.privacy_requests (created_at)
  where status in ('new', 'in_progress');

alter table public.privacy_requests enable row level security;

drop policy if exists privacy_requests_admin_select on public.privacy_requests;
create policy privacy_requests_admin_select on public.privacy_requests
  for select using (is_admin());

drop policy if exists privacy_requests_admin_update on public.privacy_requests;
create policy privacy_requests_admin_update on public.privacy_requests
  for update using (is_admin()) with check (is_admin());

insert into public.schema_migrations_log (filename, note)
values ('20260926000300_privacy_requests.sql', 'bu çalıştırmada uygulandı')
on conflict (filename) do nothing;
