-- =============================================================================
-- P7 — SEZONLUK MODÜL GEÇİŞİ
--
-- businesses.active_modules'e modül ekleme/çıkarma, tek bir atomik SQL
-- fonksiyonundan geçer: "varsa dokunma, yoksa ekle" kuralı veritabanında
-- uygulanır ve fonksiyon yalnızca GERÇEKTEN değişen satırların kimliklerini
-- döner — bildirim yalnızca onlara gider, cron iki kez çalışsa bile kimseye
-- ikinci bir "aktif edildi" mesajı gitmez.
--
-- Çağıranlar: admin paneli (/admin/moduller) ve her yıl 1 Ekim'de çalışan
-- Vercel Cron işi (/api/cron/seasonal-modules). İkisi de servis rolüyle
-- çağırır; fonksiyonlar authenticated/anon'a kapalı (guard trigger zaten
-- admin olmayanların bu kolonu değiştirmesini engelliyor, bu ikinci kapı).
-- =============================================================================

create or replace function public.business_modules_add(p_business_ids uuid[], p_module text)
returns table (business_id uuid)
language sql
set search_path = public
as $$
  update businesses b
     set active_modules = array_append(b.active_modules, p_module)
   where b.id = any (p_business_ids)
     and not (p_module = any (b.active_modules))
  returning b.id;
$$;

create or replace function public.business_modules_remove(p_business_ids uuid[], p_module text)
returns table (business_id uuid)
language sql
set search_path = public
as $$
  update businesses b
     set active_modules = array_remove(b.active_modules, p_module)
   where b.id = any (p_business_ids)
     and p_module = any (b.active_modules)
  returning b.id;
$$;

revoke all on function public.business_modules_add(uuid[], text) from public, anon, authenticated;
revoke all on function public.business_modules_remove(uuid[], text) from public, anon, authenticated;
grant execute on function public.business_modules_add(uuid[], text) to service_role;
grant execute on function public.business_modules_remove(uuid[], text) to service_role;

-- Her modül değişikliğinin ve gönderilen bildirimin kaydı (admin ekranında
-- "son geçişler" listesi, bildirim başarısızlıklarının takibi).
create table if not exists business_module_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  module text not null,
  action text not null check (action in ('added', 'removed')),
  source text not null check (source in ('admin', 'cron')),
  actor_id uuid references auth.users (id) on delete set null,
  notification_channel text check (notification_channel in ('sms', 'email', 'none')),
  notification_status text check (notification_status in ('sent', 'simulated', 'failed', 'skipped')),
  notification_error text,
  created_at timestamptz not null default now()
);

create index if not exists idx_business_module_events_created_at
  on business_module_events (created_at desc);

alter table business_module_events enable row level security;

drop policy if exists "business_module_events_select_admin" on business_module_events;
create policy "business_module_events_select_admin"
  on business_module_events for select
  using (is_admin());

insert into public.schema_migrations_log (filename, note)
values ('20260925000200_seasonal_modules.sql', 'bu çalıştırmada uygulandı')
on conflict (filename) do nothing;
