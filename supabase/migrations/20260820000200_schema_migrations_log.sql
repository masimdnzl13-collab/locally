-- Bu migration'ların veritabanına GERÇEKTEN uygulanıp uygulanmadığını takip
-- eden basit bir kayıt defteri.
--
-- KÖK NEDEN: migration'lar zaman zaman Supabase CLI (`supabase db push`)
-- yerine SQL Editor'e elle yapıştırılarak uygulandı. Bu da Supabase'in
-- kendi dahili takip tablosuna (supabase_migrations.schema_migrations)
-- hiç yazılmadığı, dolayısıyla hangi migration'ın gerçekten uygulandığının
-- zamanla tahmin/varsayım konusu olduğu anlamına geliyordu — tam olarak bu
-- yüzden APPLY_PENDING_MIGRATIONS.sql'in önceki sürümleri yanlış varsayımlar
-- üzerine kuruldu. Bu tablo o boşluğu kalıcı olarak kapatır.
--
-- KULLANIM (bundan sonraki her yeni migration için): dosyanın EN SONUNA,
-- kendi dosya adınla şunu ekle:
--
--   insert into public.schema_migrations_log (filename)
--   values ('20261231000000_dosya_adi.sql')
--   on conflict (filename) do nothing;
--
-- Böylece dosya `supabase db push` ile değil de SQL Editor'e elle
-- yapıştırılarak çalıştırılsa bile burada iz bırakır ve bir daha "hangi
-- migration uygulandı?" sorusu tahmine kalmaz.

create table if not exists public.schema_migrations_log (
  filename text primary key,
  applied_at timestamptz not null default now(),
  note text
);

alter table public.schema_migrations_log enable row level security;
-- Bilinçli olarak hiç policy tanımlı değil: yalnızca service role / SQL
-- Editor (postgres rolü) erişebilir, client'tan asla okunamaz/yazılamaz —
-- admin_emails ile aynı desen.

-- =========================================================
-- GERİYE DÖNÜK TESPİT: her migration'ın oluşturduğu bilinen bir "imza"
-- nesnenin (tablo/kolon/fonksiyon) hâlâ var olup olmadığına bakarak, daha
-- önce uygulanmış migration'ları tek seferlik olarak bu deftere işler.
-- Bir satır zaten kayıtlıysa (ON CONFLICT DO NOTHING) tekrar dokunulmaz —
-- yani applied_at, o migration'ın GERÇEKTEN ilk tespit edildiği ana sabit
-- kalır, bu blok her çalıştığında güncellenmez.
-- =========================================================

insert into public.schema_migrations_log (filename, note)
select '20260711003340_init_schema.sql', 'geriye dönük tespit edildi (bu çalıştırmadan önce uygulanmış olabilir)'
where exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'profiles')
on conflict (filename) do nothing;

insert into public.schema_migrations_log (filename, note)
select '20260711010000_storage_business_images.sql', 'geriye dönük tespit edildi (bu çalıştırmadan önce uygulanmış olabilir)'
where exists (select 1 from storage.buckets where id = 'business-images')
on conflict (filename) do nothing;

insert into public.schema_migrations_log (filename, note)
select '20260711020000_founder_waitlist.sql', 'geriye dönük tespit edildi (bu çalıştırmadan önce uygulanmış olabilir)'
where exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'founder_waitlist')
on conflict (filename) do nothing;

insert into public.schema_migrations_log (filename, note)
select '20260712000000_flash_deal_reservations.sql', 'geriye dönük tespit edildi (bu çalıştırmadan önce uygulanmış olabilir)'
where exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'flash_deal_reservations')
on conflict (filename) do nothing;

insert into public.schema_migrations_log (filename, note)
select '20260713000000_ticket_qr_and_capacity_lock.sql', 'geriye dönük tespit edildi (bu çalıştırmadan önce uygulanmış olabilir)'
where exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'tickets' and column_name = 'qr_code')
on conflict (filename) do nothing;

insert into public.schema_migrations_log (filename, note)
select '20260714000000_package_management.sql', 'geriye dönük tespit edildi (bu çalıştırmadan önce uygulanmış olabilir)'
where exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'packages' and column_name = 'per_person_limit')
on conflict (filename) do nothing;

insert into public.schema_migrations_log (filename, note)
select '20260715000000_package_image.sql', 'geriye dönük tespit edildi (bu çalıştırmadan önce uygulanmış olabilir)'
where exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'packages' and column_name = 'image_url')
on conflict (filename) do nothing;

insert into public.schema_migrations_log (filename, note)
select '20260716000000_event_management.sql', 'geriye dönük tespit edildi (bu çalıştırmadan önce uygulanmış olabilir)'
where exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'events' and column_name = 'is_cancelled')
on conflict (filename) do nothing;

insert into public.schema_migrations_log (filename, note)
select '20260717000000_verification.sql', 'geriye dönük tespit edildi (bu çalıştırmadan önce uygulanmış olabilir)'
where exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'verification_logs')
on conflict (filename) do nothing;

insert into public.schema_migrations_log (filename, note)
select '20260718000000_customer_crm.sql', 'geriye dönük tespit edildi (bu çalıştırmadan önce uygulanmış olabilir)'
where exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'customers' and column_name = 'notes')
on conflict (filename) do nothing;

insert into public.schema_migrations_log (filename, note)
select '20260719000000_announcements.sql', 'geriye dönük tespit edildi (bu çalıştırmadan önce uygulanmış olabilir)'
where exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'announcements' and column_name = 'target_segment')
on conflict (filename) do nothing;

insert into public.schema_migrations_log (filename, note)
select '20260720000000_cron_jobs.sql', 'geriye dönük tespit edildi (bu çalıştırmadan önce uygulanmış olabilir)'
where exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'cron_logs')
on conflict (filename) do nothing;

insert into public.schema_migrations_log (filename, note)
select '20260721000000_iyzico_marketplace.sql', 'geriye dönük tespit edildi (bu çalıştırmadan önce uygulanmış olabilir)'
where exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'platform_settings')
on conflict (filename) do nothing;

insert into public.schema_migrations_log (filename, note)
select '20260722000000_admin_panel.sql', 'geriye dönük tespit edildi (bu çalıştırmadan önce uygulanmış olabilir)'
where exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'businesses' and column_name = 'suspend_reason')
on conflict (filename) do nothing;

insert into public.schema_migrations_log (filename, note)
select '20260723000000_admin_allowlist_and_ai_assistant.sql', 'APPLY_PENDING_MIGRATIONS.sql ile bu çalıştırmada uygulandı'
where exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'admin_emails')
on conflict (filename) do nothing;

insert into public.schema_migrations_log (filename, note)
select '20260724000000_pilot_mode_enum.sql', 'APPLY_PENDING_MIGRATIONS.sql ile bu çalıştırmada uygulandı'
where exists (
  select 1 from pg_enum en join pg_type ty on ty.oid = en.enumtypid
  where ty.typname = 'purchase_status' and en.enumlabel = 'reserved'
)
on conflict (filename) do nothing;

insert into public.schema_migrations_log (filename, note)
select '20260724000100_pilot_mode.sql', 'APPLY_PENDING_MIGRATIONS.sql ile bu çalıştırmada uygulandı'
where exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'cancel_package_reservation'
)
on conflict (filename) do nothing;

insert into public.schema_migrations_log (filename, note)
select '20260725000000_demo_data_flags.sql', 'APPLY_PENDING_MIGRATIONS.sql ile bu çalıştırmada uygulandı'
where exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'is_demo')
on conflict (filename) do nothing;

insert into public.schema_migrations_log (filename, note)
select '20260725000100_demo_data_load.sql', 'APPLY_PENDING_MIGRATIONS.sql ile bu çalıştırmada uygulandı'
where exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'admin_load_demo_data'
)
on conflict (filename) do nothing;

-- admin_role_sync.sql yalnızca bir veri güncellemesi (UPDATE) — arkasında
-- tespit edilebilecek kalıcı bir şema imzası bırakmaz. Bu betiğin kendisi
-- bu noktaya, o UPDATE'i çalıştırdıktan SONRA ulaştığı için koşulsuz kayıt
-- ediliyor (bkz. APPLY_PENDING_MIGRATIONS.sql'deki KAYNAK DOSYA bölümü).
insert into public.schema_migrations_log (filename, note)
values ('20260820000000_admin_role_sync.sql', 'bu çalıştırmada uygulandı (imzasız veri güncellemesi)')
on conflict (filename) do nothing;

insert into public.schema_migrations_log (filename, note)
select '20260820000100_test_lab.sql', 'APPLY_PENDING_MIGRATIONS.sql ile bu çalıştırmada uygulandı'
where exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'businesses' and column_name = 'is_test_fixture')
on conflict (filename) do nothing;

-- Bu migration'ın kendisi — çalıştığı an için koşulsuz kayıt edilir.
insert into public.schema_migrations_log (filename, note)
values ('20260820000200_schema_migrations_log.sql', 'bu çalıştırmada uygulandı')
on conflict (filename) do nothing;
