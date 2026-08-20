-- =============================================================================
-- APPLY_PENDING_MIGRATIONS.sql  (v2 — düzeltildi)
--
-- ÖNCEKİ SÜRÜM YANLIŞTI: yalnızca son 2 migration'ı içeriyordu çünkü
-- migration 15-19'un (admin allowlist'ten demo veri yüklemeye kadar) daha
-- önceki bir oturumda veritabanına hiç uygulanmadığı bilinmiyordu. Bu sürüm
-- 15'ten 21'e kadar TÜM uygulanmamış migration'ları içerir.
--
-- KULLANIM ALANI: Supabase projen hâlâ var ve migration 1-14 (init_schema'dan
-- admin_panel'e kadar) zaten uygulanmış durumda. Bu dosya, ondan SONRA
-- gelen ve hiç uygulanmamış 7 migration'ı doğru sırayla birleştirir.
--
-- Projenin SİLİNMİŞ olduğunu / gerçekten sıfırdan kurduğunu biliyorsan bu
-- dosyayı DEĞİL, FRESH_DATABASE_SETUP.sql dosyasını kullan (21 migration'ın
-- tamamını, migration 1'den başlayarak içerir).
--
-- GÜVENLİK KİLİDİ: Bu betik en başta public.admin_emails tablosunun zaten
-- var olup olmadığını kontrol eder (bu tablo aşağıdaki 7 migration'ın
-- İLKİ tarafından oluşturulur). Varsa, betik HİÇBİR ŞEY YAPMADAN açık bir
-- hatayla durur — böylece bunu yanlışlıkla iki kez çalıştırırsan
-- (ör. "az önce çalıştırdım mıydı?" belirsizliğinde) veri bozulmaz.
--
-- ÇALIŞTIRMA: Supabase Dashboard → SQL Editor → bu dosyanın tamamını
-- yapıştır → Run. Hata alırsan hangi KAYNAK DOSYA yorumunun altında
-- kaldığına bakarak orijinal migration dosyasını repoda bul.
--
-- İÇİNDEKİLER (kronolojik sıra):
--   1) 20260723000000_admin_allowlist_and_ai_assistant.sql
--   2) 20260724000000_pilot_mode_enum.sql
--   3) 20260724000100_pilot_mode.sql
--   4) 20260725000000_demo_data_flags.sql
--   5) 20260725000100_demo_data_load.sql
--   6) 20260820000000_admin_role_sync.sql
--   7) 20260820000100_test_lab.sql
-- =============================================================================

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'admin_emails'
  ) then
    raise exception 'ALREADY_APPLIED: public.admin_emails zaten var — bu 7 migration daha önce uygulanmış görünüyor. Tekrar çalıştırmak veri bozabilir, bu yüzden betik burada durduruldu. Emin değilsen Supabase Dashboard → Database → Tables''tan admin_emails, ai_generation_logs, verification_logs gibi tabloların var olup olmadığını elle kontrol et.';
  end if;
end $$;


-- ============================================================================
-- KAYNAK DOSYA: supabase/migrations/20260723000000_admin_allowlist_and_ai_assistant.sql
-- ============================================================================

-- Admin e-posta beyaz listesi: bu tabloda kayıtlı bir e-posta ile kayıt
-- olan (veya zaten kayıtlı olan) kullanıcıya profiles.role otomatik
-- 'admin' atanır. Sadece sunucu tarafı (service role) erişebilir; RLS
-- açık ama hiçbir policy tanımlı değil, yani client'tan asla okunamaz/yazılamaz.
create table admin_emails (
  email text primary key,
  created_at timestamptz not null default now()
);

alter table admin_emails enable row level security;

insert into admin_emails (email) values ('m.asimdnzl13@gmail.com');

-- AI kampanya asistanı kullanım logu: hangi işletme, ne zaman, hangi
-- amaçla (paket başlığı/metni veya duyuru mesajı) ne kadar istek attı.
create table ai_generation_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  kind text not null check (kind in ('paket', 'duyuru')),
  tone text,
  created_at timestamptz not null default now()
);

create index ai_generation_logs_business_id_idx on ai_generation_logs (business_id);

alter table ai_generation_logs enable row level security;

create policy "ai_generation_logs_select_owner_or_admin"
  on ai_generation_logs for select
  using (owns_business(business_id) or is_admin());

create policy "ai_generation_logs_insert_owner"
  on ai_generation_logs for insert
  with check (owns_business(business_id));

-- ==== supabase/migrations/20260723000000_admin_allowlist_and_ai_assistant.sql SONU ====


-- ============================================================================
-- KAYNAK DOSYA: supabase/migrations/20260724000000_pilot_mode_enum.sql
-- ============================================================================

-- PİLOT MOD: ödeme platformdan geçmez, işletmede nakit/kart alınır.
-- Yeni purchase_status değerleri ayrı bir migration'da eklenir çünkü
-- Postgres aynı transaction içinde yeni eklenen enum değerini hemen
-- kullanmaya izin vermez (bir sonraki migration'da kullanılır).

alter type purchase_status add value 'reserved';
alter type purchase_status add value 'cancelled';

-- Bir rezervasyonun neden iptal/düşme olduğunu ayırt etmek için
-- (işletme elle iptal etti mi, yoksa uzun süre gelinmediği için
-- otomatik mi düştü).
alter table purchases add column cancelled_reason text;

-- ==== supabase/migrations/20260724000000_pilot_mode_enum.sql SONU ====


-- ============================================================================
-- KAYNAK DOSYA: supabase/migrations/20260724000100_pilot_mode.sql
-- ============================================================================

-- PİLOT MOD mantığı: kullanıcı paketi uygulamadan "ayırtır" (status='reserved'),
-- hak/QR hemen üretilir ama ödeme mekânda alınır. İşletme ilk QR
-- doğrulamasını yaptığında rezervasyon otomatik 'completed' (aktif) olur
-- ve bu ilk doğrulama aynı zamanda ilk hakkı da düşer.

-- =========================================================
-- 1) Hak üretimi artık 'completed' YANINDA 'reserved' insert'te de çalışır
-- =========================================================
create or replace function public.create_entitlement_on_purchase_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usage_count int;
  v_code text;
begin
  if (new.status = 'completed' and (tg_op = 'INSERT' or old.status is distinct from 'completed'))
     or (new.status = 'reserved' and tg_op = 'INSERT') then

    select usage_count into v_usage_count from packages where id = new.package_id;

    loop
      v_code := 'LCL' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
      exit when not exists (select 1 from entitlements where qr_code = v_code);
    end loop;

    insert into entitlements (purchase_id, remaining_uses, qr_code, status)
    values (new.id, v_usage_count, v_code, 'active');

    update packages set sold_count = sold_count + 1 where id = new.package_id;
  end if;

  return new;
end;
$$;

-- =========================================================
-- 2) verify_code(): paket hakkı dalında ilk başarılı doğrulama, hâlâ
--    'reserved' durumundaki rezervasyonu 'completed' (aktif) yapar.
-- =========================================================
create or replace function public.verify_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_code text := upper(trim(p_code));
  v_code_type text;
  v_result jsonb;

  v_entitlement entitlements%rowtype;
  v_package packages%rowtype;
  v_purchase_user_id uuid;
  v_purchase_status purchase_status;

  v_reservation flash_deal_reservations%rowtype;
  v_deal flash_deals%rowtype;

  v_ticket tickets%rowtype;
  v_event events%rowtype;

  v_customer jsonb;
  v_customer_name text;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED: Giriş yapmalısın';
  end if;

  select id into v_business_id
  from businesses
  where owner_id = auth.uid()
  order by created_at desc
  limit 1;

  if v_business_id is null then
    raise exception 'NOT_BUSINESS: İşletme hesabı bulunamadı';
  end if;

  if left(v_code, 3) = 'LCL' then
    v_code_type := 'package';
  elsif left(v_code, 3) = 'FLA' then
    v_code_type := 'flash';
  elsif left(v_code, 3) = 'TKT' then
    v_code_type := 'ticket';
  else
    v_code_type := 'unknown';
  end if;

  -- ---------------------------------------------------------------
  -- PAKET HAKKI
  -- ---------------------------------------------------------------
  if v_code_type = 'package' then
    select e.* into v_entitlement from entitlements e where e.qr_code = v_code for update;

    if not found then
      v_result := jsonb_build_object('success', false, 'error_code', 'INVALID_CODE', 'message', 'Geçersiz kod');
    else
      select p.* into v_package from packages p
        join purchases pu on pu.package_id = p.id
        where pu.id = v_entitlement.purchase_id;
      select pu.user_id, pu.status into v_purchase_user_id, v_purchase_status
        from purchases pu where pu.id = v_entitlement.purchase_id;
      select full_name into v_customer_name from profiles where id = v_purchase_user_id;

      if v_package.business_id <> v_business_id then
        v_result := jsonb_build_object('success', false, 'error_code', 'WRONG_BUSINESS', 'message', 'Bu kod sizin işletmenize ait değil');
      elsif v_purchase_status = 'cancelled' then
        v_result := jsonb_build_object('success', false, 'error_code', 'CANCELLED', 'message', 'Bu rezervasyon iptal edilmiş', 'customer_name', v_customer_name, 'detail', v_package.title);
      elsif v_entitlement.status <> 'active' or v_entitlement.remaining_uses <= 0 then
        v_result := jsonb_build_object('success', false, 'error_code', 'NO_USES_LEFT', 'message', 'Bu kodda kullanılabilir hak kalmamış', 'customer_name', v_customer_name, 'detail', v_package.title);
      elsif v_package.expires_at < now() then
        update entitlements set status = 'expired' where id = v_entitlement.id;
        v_result := jsonb_build_object('success', false, 'error_code', 'EXPIRED', 'message', 'Paketin süresi dolmuş', 'customer_name', v_customer_name, 'detail', v_package.title);
      else
        update entitlements
        set remaining_uses = remaining_uses - 1,
            status = (case when remaining_uses - 1 <= 0 then 'used' else 'active' end)::entitlement_status
        where id = v_entitlement.id;

        -- Pilot mod: ilk doğrulama rezervasyonu ödeme bekleyenden aktife çevirir.
        update purchases set status = 'completed' where id = v_entitlement.purchase_id and status = 'reserved';

        insert into redemptions (entitlement_id, business_id, verified_by)
        values (v_entitlement.id, v_business_id, auth.uid());

        v_customer := public._touch_customer(v_business_id, v_purchase_user_id);

        v_result := jsonb_build_object(
          'success', true,
          'customer_name', coalesce(v_customer->>'full_name', v_customer->>'phone', 'Müşteri'),
          'detail', v_package.title,
          'data', jsonb_build_object(
            'package_title', v_package.title,
            'remaining_uses', greatest(v_entitlement.remaining_uses - 1, 0),
            'usage_count', v_package.usage_count,
            'activated', v_purchase_status = 'reserved'
          )
        );
      end if;
    end if;

  -- ---------------------------------------------------------------
  -- FLAŞ AYIRTMASI
  -- ---------------------------------------------------------------
  elsif v_code_type = 'flash' then
    select r.* into v_reservation from flash_deal_reservations r where r.confirmation_code = v_code for update;

    if not found then
      v_result := jsonb_build_object('success', false, 'error_code', 'INVALID_CODE', 'message', 'Geçersiz kod');
    else
      select d.* into v_deal from flash_deals d where d.id = v_reservation.flash_deal_id;
      select full_name into v_customer_name from profiles where id = v_reservation.user_id;

      if v_deal.business_id <> v_business_id then
        v_result := jsonb_build_object('success', false, 'error_code', 'WRONG_BUSINESS', 'message', 'Bu kod sizin işletmenize ait değil');
      elsif v_reservation.status = 'redeemed' then
        v_result := jsonb_build_object(
          'success', false, 'error_code', 'ALREADY_USED',
          'message', 'Bu ayırtma zaten kullanılmış — saat ' || to_char(v_reservation.redeemed_at, 'HH24:MI') || '''de',
          'customer_name', v_customer_name, 'detail', v_deal.offer_text
        );
      else
        update flash_deal_reservations set status = 'redeemed', redeemed_at = now() where id = v_reservation.id;

        v_customer := public._touch_customer(v_business_id, v_reservation.user_id);

        v_result := jsonb_build_object(
          'success', true,
          'customer_name', coalesce(v_customer->>'full_name', v_customer->>'phone', 'Müşteri'),
          'detail', v_deal.offer_text,
          'data', jsonb_build_object('offer_text', v_deal.offer_text)
        );
      end if;
    end if;

  -- ---------------------------------------------------------------
  -- ETKİNLİK BİLETİ
  -- ---------------------------------------------------------------
  elsif v_code_type = 'ticket' then
    select t.* into v_ticket from tickets t where t.qr_code = v_code for update;

    if not found then
      v_result := jsonb_build_object('success', false, 'error_code', 'INVALID_CODE', 'message', 'Geçersiz kod');
    else
      select e.* into v_event from events e where e.id = v_ticket.event_id;
      select full_name into v_customer_name from profiles where id = v_ticket.user_id;

      if v_event.business_id <> v_business_id then
        v_result := jsonb_build_object('success', false, 'error_code', 'WRONG_BUSINESS', 'message', 'Bu kod sizin işletmenize ait değil');
      elsif v_ticket.status = 'cancelled' then
        v_result := jsonb_build_object('success', false, 'error_code', 'CANCELLED', 'message', 'Bu bilet iptal edilmiş', 'customer_name', v_customer_name, 'detail', v_event.title);
      elsif v_ticket.status = 'used' then
        v_result := jsonb_build_object(
          'success', false, 'error_code', 'ALREADY_USED',
          'message', 'Bu bilet zaten kullanılmış — saat ' || to_char(v_ticket.checked_in_at, 'HH24:MI') || '''de',
          'customer_name', v_customer_name, 'detail', v_event.title
        );
      else
        update tickets set status = 'used', checked_in_at = now() where id = v_ticket.id;

        v_customer := public._touch_customer(v_business_id, v_ticket.user_id);

        v_result := jsonb_build_object(
          'success', true,
          'customer_name', coalesce(v_customer->>'full_name', v_customer->>'phone', 'Müşteri'),
          'detail', v_event.title,
          'data', jsonb_build_object('event_title', v_event.title)
        );
      end if;
    end if;

  else
    v_result := jsonb_build_object('success', false, 'error_code', 'INVALID_CODE', 'message', 'Geçersiz kod formatı');
  end if;

  insert into verification_logs (business_id, code, code_type, result, error_code, customer_name, detail, verified_by)
  values (
    v_business_id,
    v_code,
    v_code_type,
    case when (v_result->>'success')::boolean then 'success' else 'error' end,
    v_result->>'error_code',
    v_result->>'customer_name',
    v_result->>'detail',
    auth.uid()
  );

  return v_result || jsonb_build_object('code_type', v_code_type);
end;
$$;

-- =========================================================
-- 3) İşletmenin elle rezervasyon iptali (yalnızca 'reserved' iken)
-- =========================================================
create or replace function public.cancel_package_reservation(p_purchase_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purchase purchases%rowtype;
  v_business_id uuid;
begin
  select * into v_purchase from purchases where id = p_purchase_id for update;

  if not found then
    raise exception 'NOT_FOUND: Rezervasyon bulunamadı';
  end if;

  select business_id into v_business_id from packages where id = v_purchase.package_id;

  if not (owns_business(v_business_id) or is_admin()) then
    raise exception 'FORBIDDEN: Bu rezervasyon size ait değil';
  end if;

  if v_purchase.status <> 'reserved' then
    raise exception 'NOT_ELIGIBLE: Yalnızca ödeme bekleyen rezervasyonlar iptal edilebilir';
  end if;

  update purchases
  set status = 'cancelled', cancelled_reason = coalesce(p_reason, 'business_cancelled')
  where id = p_purchase_id;

  update entitlements set status = 'expired', remaining_uses = 0 where purchase_id = p_purchase_id;

  update packages set sold_count = greatest(sold_count - 1, 0) where id = v_purchase.package_id;

  return jsonb_build_object('success', true);
end;
$$;

revoke all on function public.cancel_package_reservation(uuid, text) from public;
grant execute on function public.cancel_package_reservation(uuid, text) to authenticated;

-- =========================================================
-- 4) Cron (servis rolü) için: sold_count'u atomik düşürür
-- =========================================================
create or replace function public.decrement_package_sold_count(p_package_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update packages set sold_count = greatest(sold_count - 1, 0) where id = p_package_id;
$$;

revoke all on function public.decrement_package_sold_count(uuid) from public;
grant execute on function public.decrement_package_sold_count(uuid) to service_role;

-- ==== supabase/migrations/20260724000100_pilot_mode.sql SONU ====


-- ============================================================================
-- KAYNAK DOSYA: supabase/migrations/20260725000000_demo_data_flags.sql
-- ============================================================================

-- Demo veri seti altyapısı: hangi kayıtların demo olduğunu işaretleyen
-- bayraklar + admin panelinden tek tıkla temizleme. Gerçek verilere asla
-- dokunmaz çünkü her şey is_demo = true filtresiyle sınırlanır.

alter table profiles add column is_demo boolean not null default false;
alter table businesses add column is_demo boolean not null default false;

create index idx_profiles_is_demo on profiles (is_demo) where is_demo;
create index idx_businesses_is_demo on businesses (is_demo) where is_demo;

-- =========================================================
-- Demo veri özeti (admin panelinde tek bakışta durum göstermek için)
-- =========================================================
create or replace function public.admin_demo_data_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_businesses int;
  v_users int;
  v_packages int;
  v_purchases int;
begin
  if not is_admin() then
    raise exception 'FORBIDDEN: Yalnızca admin görebilir';
  end if;

  select count(*) into v_businesses from businesses where is_demo;
  select count(*) into v_users from profiles where is_demo;
  select count(*) into v_packages from packages p
    join businesses b on b.id = p.business_id where b.is_demo;
  select count(*) into v_purchases from purchases pu
    where pu.user_id in (select id from profiles where is_demo)
       or pu.package_id in (select id from packages p join businesses b on b.id = p.business_id where b.is_demo);

  return jsonb_build_object(
    'loaded', v_businesses > 0,
    'businesses', v_businesses,
    'users', v_users,
    'packages', v_packages,
    'purchases', v_purchases
  );
end;
$$;

revoke all on function public.admin_demo_data_summary() from public;
grant execute on function public.admin_demo_data_summary() to authenticated;

-- =========================================================
-- Demo verisini tamamen ve güvenle temizler. Yalnızca is_demo=true
-- işaretli kayıtları siler; gerçek kayıtlara asla dokunmaz. Bazı foreign
-- key'ler (purchases.package_id, redemptions.entitlement_id/business_id)
-- cascade değil, bu yüzden silme sırası önemli.
-- =========================================================
create or replace function public.admin_clear_demo_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted_businesses int;
  v_deleted_profiles int;
begin
  if not is_admin() then
    raise exception 'FORBIDDEN: Yalnızca admin çalıştırabilir';
  end if;

  delete from redemptions
  where business_id in (select id from businesses where is_demo);

  delete from entitlements
  where purchase_id in (
    select id from purchases
    where user_id in (select id from profiles where is_demo)
       or package_id in (select id from packages p join businesses b on b.id = p.business_id where b.is_demo)
  );

  delete from purchases
  where user_id in (select id from profiles where is_demo)
     or package_id in (select id from packages p join businesses b on b.id = p.business_id where b.is_demo);

  -- businesses silinince packages/flash_deals/events/customers/
  -- verification_logs/announcements/flash_deal_reservations/tickets
  -- cascade ile otomatik silinir.
  delete from businesses where is_demo;
  get diagnostics v_deleted_businesses = row_count;

  -- Kalan demo profiller (demo müşteriler + varsa artık iş. sahibi
  -- olmayanlar) auth.users üzerinden silinir, profiles cascade ile gider.
  delete from auth.users where id in (select id from profiles where is_demo);
  get diagnostics v_deleted_profiles = row_count;

  return jsonb_build_object(
    'success', true,
    'deleted_businesses', v_deleted_businesses,
    'deleted_users', v_deleted_profiles
  );
end;
$$;

revoke all on function public.admin_clear_demo_data() from public;
grant execute on function public.admin_clear_demo_data() to authenticated;

-- ==== supabase/migrations/20260725000000_demo_data_flags.sql SONU ====


-- ============================================================================
-- KAYNAK DOSYA: supabase/migrations/20260725000100_demo_data_load.sql
-- ============================================================================

-- Demo veri seti: Bodrum'da 12 kurgusal işletme, paketler, flaş fırsatlar,
-- etkinlikler ve ~30 demo kullanıcı üzerinden geçmiş hareket. Tüm kurgusal
-- isimler gerçek işletmelerle örtüşmeyecek şekilde uydurulmuştur. Her satır
-- is_demo=true (veya demo işletme/kullanıcıya bağlı) olduğu için
-- admin_clear_demo_data() ile güvenle geri alınabilir. Sabit UUID + ON
-- CONFLICT DO NOTHING sayesinde fonksiyon tekrar çağrılsa da hata vermez.

create or replace function public.admin_load_demo_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_biz record;
  v_user_id uuid;
  v_i int;
  v_business_ids uuid[];
  v_package_ids uuid[];
  v_package_id uuid;
  v_pkg record;
  v_days_ago numeric;
begin
  if not is_admin() then
    raise exception 'FORBIDDEN: Yalnızca admin çalıştırabilir';
  end if;

  -- ---------------------------------------------------------------
  -- 1) İŞLETMELER (12 adet, kurgusal isim, Bodrum mahalleleri)
  -- ---------------------------------------------------------------
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values
    ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'demo.b01@locally.test', crypt('DemoPilot2026!', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Demo İşletme 1"}', false, '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'demo.b02@locally.test', crypt('DemoPilot2026!', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Demo İşletme 2"}', false, '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'demo.b03@locally.test', crypt('DemoPilot2026!', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Demo İşletme 3"}', false, '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'demo.b04@locally.test', crypt('DemoPilot2026!', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Demo İşletme 4"}', false, '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'demo.b05@locally.test', crypt('DemoPilot2026!', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Demo İşletme 5"}', false, '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'demo.b06@locally.test', crypt('DemoPilot2026!', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Demo İşletme 6"}', false, '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-4000-8000-000000000007', 'authenticated', 'authenticated', 'demo.b07@locally.test', crypt('DemoPilot2026!', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Demo İşletme 7"}', false, '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-4000-8000-000000000008', 'authenticated', 'authenticated', 'demo.b08@locally.test', crypt('DemoPilot2026!', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Demo İşletme 8"}', false, '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-4000-8000-000000000009', 'authenticated', 'authenticated', 'demo.b09@locally.test', crypt('DemoPilot2026!', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Demo İşletme 9"}', false, '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-4000-8000-000000000010', 'authenticated', 'authenticated', 'demo.b10@locally.test', crypt('DemoPilot2026!', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Demo İşletme 10"}', false, '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-4000-8000-000000000011', 'authenticated', 'authenticated', 'demo.b11@locally.test', crypt('DemoPilot2026!', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Demo İşletme 11"}', false, '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-4000-8000-000000000012', 'authenticated', 'authenticated', 'demo.b12@locally.test', crypt('DemoPilot2026!', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Demo İşletme 12"}', false, '', '', '', '')
  on conflict (id) do nothing;

  insert into profiles (id, full_name, phone, role, is_demo)
  select 'd0000000-0000-4000-8000-00000000000' || g, 'Demo İşletme ' || g, '05' || (300000000 + g)::text, 'business', true
  from generate_series(1, 12) g
  on conflict (id) do nothing;

  insert into businesses (id, owner_id, name, slug, description, category, city, district, phone, instagram, approval_status, iyzico_onboarding_status, cover_url, logo_url, is_demo)
  values
    ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'Liman Fırın Kahve', 'liman-firin-kahve-demo', 'Bodrum limanına beş dakika, taze simit ve el yapımı filtre kahvesiyle sabahçı bir kahveci.', 'kafe', 'Bodrum', 'Merkez', '05323330001', '@limanfirinkahve', 'approved', 'approved', 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=1200&q=80', null, true),
    ('e0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000002', 'Rüzgar Koyu Restoran', 'ruzgar-koyu-restoran-demo', 'Yalıkavak''ta deniz mahsulleri ve ev yapımı mezelerle akşam sofrası kuran aile restoranı.', 'restoran', 'Bodrum', 'Yalıkavak', '05323330002', '@ruzgarkoyu', 'approved', 'approved', 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=80', null, true),
    ('e0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000003', 'Gümbet Beach Club', 'gumbet-beach-club-demo', 'Gümbet sahilinde gün batımı manzaralı şezlong, kokteyl ve DJ setleriyle beach club.', 'beach_club', 'Bodrum', 'Gümbet', '05323330003', '@gumbetbeachclub', 'approved', 'approved', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80', null, true),
    ('e0000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000004', 'Taşev Butik Otel', 'tasev-butik-otel-demo', 'Türkbükü''nde taş mimarisiyle öne çıkan, kahvaltı dahil butik otel.', 'otel', 'Bodrum', 'Türkbükü', '05323330004', '@tasevbutik', 'approved', 'approved', 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&q=80', null, true),
    ('e0000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000005', 'Kumburnu Dalış Merkezi', 'kumburnu-dalis-merkezi-demo', 'Bitez koyunda başlangıç seviyesi tüplü dalış ve tekne turu düzenleyen aktivite merkezi.', 'aktivite', 'Bodrum', 'Bitez', '05323330005', '@kumburnudalis', 'approved', 'approved', 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1200&q=80', null, true),
    ('e0000000-0000-4000-8000-000000000006', 'd0000000-0000-4000-8000-000000000006', 'Menekşe Sofra Evi', 'menekse-sofra-evi-demo', 'Konacık''ta ev yemekleri ve günlük çorbalarla esnaf lokantası.', 'restoran', 'Bodrum', 'Konacık', '05323330006', '@menekseevi', 'approved', 'approved', 'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=1200&q=80', null, true),
    ('e0000000-0000-4000-8000-000000000007', 'd0000000-0000-4000-8000-000000000007', 'Kahve Diyarı Ortakent', 'kahve-diyari-ortakent-demo', 'Ortakent''te üçüncü nesil kahve ve ev yapımı kek çeşitleriyle mahalle kahvecisi.', 'kafe', 'Bodrum', 'Ortakent', '05323330007', '@kahvediyari', 'approved', 'approved', 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1200&q=80', null, true),
    ('e0000000-0000-4000-8000-000000000008', 'd0000000-0000-4000-8000-000000000008', 'Akyarlar Rüzgar Sörf', 'akyarlar-ruzgar-sorf-demo', 'Akyarlar''da rüzgar sörfü ve kite dersleri veren aktivite okulu.', 'aktivite', 'Bodrum', 'Akyarlar', '05323330008', '@akyarlarsorf', 'approved', 'approved', 'https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=1200&q=80', null, true),
    ('e0000000-0000-4000-8000-000000000009', 'd0000000-0000-4000-8000-000000000009', 'Sahil Balık Lokantası', 'sahil-balik-lokantasi-demo', 'Gündoğan''da günlük av balık çeşitleriyle sahil lokantası.', 'restoran', 'Bodrum', 'Gündoğan', '05323330009', '@sahilbalik', 'approved', 'approved', 'https://images.unsplash.com/photo-1544025162-d76694265947?w=1200&q=80', null, true),
    ('e0000000-0000-4000-8000-000000000010', 'd0000000-0000-4000-8000-000000000010', 'Zeytin Dalı Otel', 'zeytin-dali-otel-demo', 'Torba''da zeytinlik manzaralı, havuzlu küçük otel.', 'otel', 'Bodrum', 'Torba', '05323330010', '@zeytindaliotel', 'approved', 'approved', 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&q=80', null, true),
    ('e0000000-0000-4000-8000-000000000011', 'd0000000-0000-4000-8000-000000000011', 'Mola Cafe Bar', 'mola-cafe-bar-demo', 'Bodrum merkezde canlı müzik eşliğinde akşam kokteylleri sunan cafe bar.', 'diger', 'Bodrum', 'Merkez', '05323330011', '@molacafebar', 'approved', 'approved', 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=1200&q=80', null, true),
    ('e0000000-0000-4000-8000-000000000012', 'd0000000-0000-4000-8000-000000000012', 'Gölköy Yat Kulübü', 'golkoy-yat-kulubu-demo', 'Gölköy''de tekne turu ve gün batımı yemek organizasyonları düzenleyen kulüp.', 'aktivite', 'Bodrum', 'Gölköy', '05323330012', '@golkoyyat', 'approved', 'approved', 'https://images.unsplash.com/photo-1540946485063-a40da27545f8?w=1200&q=80', null, true)
  on conflict (id) do nothing;

  select array_agg(id) into v_business_ids from businesses where is_demo;

  -- ---------------------------------------------------------------
  -- 2) PAKETLER — her işletmeye 1-2 kış paketi, biri kontenjanı dolu,
  --    biri süresi yakında bitiyor, biri bol süreli.
  -- ---------------------------------------------------------------
  for v_i in 1..12 loop
    insert into packages (id, business_id, title, description, sale_price, summer_reference_price, normal_value, usage_count, usage_description, expires_at, quota, sold_count, per_person_limit, is_active)
    values (
      ('f0000000-0000-4000-8000-0000000000' || lpad(v_i::text, 2, '0'))::uuid,
      ('e0000000-0000-4000-8000-00000000000' || lpad(v_i::text, 2, '0'))::uuid,
      'Kış Paketi — 4 Kullanım',
      'Kış sezonuna özel indirimli kullanım paketi, dilediğin zaman gel.',
      450 + v_i * 15,
      900 + v_i * 20,
      1200 + v_i * 20,
      4,
      'Her kullanımda 1 kişi geçerlidir.',
      now() + ((5 + v_i * 5) || ' days')::interval,
      case when v_i = 3 then 10 else 40 end,
      case when v_i = 3 then 10 else (v_i % 5) end,
      2,
      true
    )
    on conflict (id) do nothing;

    -- İkinci paket: yalnızca ilk 6 işletmede, süresi yakında bitecek şekilde
    if v_i <= 6 then
      insert into packages (id, business_id, title, description, sale_price, summer_reference_price, normal_value, usage_count, usage_description, expires_at, quota, sold_count, per_person_limit, is_active)
      values (
        ('f0000000-0000-4000-8000-0000000001' || lpad(v_i::text, 2, '0'))::uuid,
        ('e0000000-0000-4000-8000-00000000000' || lpad(v_i::text, 2, '0'))::uuid,
        'Son Haftalar Fırsatı — 2 Kullanım',
        'Kış sezonunun son haftalarına özel, sınırlı süreli fırsat paketi.',
        280 + v_i * 10,
        520 + v_i * 15,
        700 + v_i * 15,
        2,
        'Her kullanımda 1 kişi geçerlidir.',
        now() + interval '4 days',
        20,
        3,
        1,
        true
      )
      on conflict (id) do nothing;
    end if;
  end loop;

  select array_agg(id) into v_package_ids from packages p join businesses b on b.id = p.business_id where b.is_demo;

  -- ---------------------------------------------------------------
  -- 3) BU AKŞAM FLAŞ FIRSATLARI — 4 aktif, biri kontenjanı bitmiş
  -- ---------------------------------------------------------------
  insert into flash_deals (id, business_id, offer_text, starts_at, ends_at, total_quota, remaining_quota, is_active)
  values
    ('a0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'Bu akşam kahve + tatlı ikilisi %40 indirimli', now() - interval '1 hour', now() + interval '4 hours', 15, 6, true),
    ('a0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000002', 'Bu akşam 2 kişilik deniz mahsulleri menüsü %30 indirimli', now() - interval '30 minutes', now() + interval '5 hours', 10, 3, true),
    ('a0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000003', 'Bu akşam şezlong + kokteyl paketi %25 indirimli', now() - interval '2 hours', now() + interval '3 hours', 20, 0, true),
    ('a0000000-0000-4000-8000-000000000006', 'e0000000-0000-4000-8000-000000000006', 'Bu akşam ev yemeği tabağı %35 indirimli', now() - interval '1 hour', now() + interval '4 hours', 12, 8, true)
  on conflict (id) do nothing;

  -- ---------------------------------------------------------------
  -- 4) ETKİNLİKLER — önümüzdeki 2 hafta, karışık ücretsiz/kontenjanlı/dolu
  -- ---------------------------------------------------------------
  insert into events (id, business_id, title, description, event_at, image_url, is_paid, ticket_price, capacity)
  values
    ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000011', 'Akustik Gece', 'Mola Cafe Bar''da yerel sanatçılardan akustik performans.', now() + interval '2 days', 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1200&q=80', false, null, null),
    ('b0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000003', 'Gün Batımı Yoga', 'Gümbet Beach Club''ta sahilde ücretsiz açık hava yogası.', now() + interval '3 days', 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=1200&q=80', false, null, 25),
    ('b0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000012', 'Gölköy Tekne Turu', 'Yarım gün tekne turu, öğle yemeği dahil.', now() + interval '5 days', 'https://images.unsplash.com/photo-1500835556837-99ac94a94552?w=1200&q=80', true, 850, 16),
    ('b0000000-0000-4000-8000-000000000004', 'e0000000-0000-4000-8000-000000000008', 'Rüzgar Sörfü Tanışma Dersi', 'Yeni başlayanlar için ücretsiz tanışma dersi.', now() + interval '6 days', 'https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?w=1200&q=80', false, null, 12),
    ('b0000000-0000-4000-8000-000000000005', 'e0000000-0000-4000-8000-000000000005', 'Gece Dalışı', 'Deneyimli dalgıçlar için rehberli gece dalışı.', now() + interval '7 days', 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1200&q=80', true, 650, 8),
    ('b0000000-0000-4000-8000-000000000006', 'e0000000-0000-4000-8000-000000000002', 'Şarap Eşliğinde Deniz Mahsulleri', 'Sommelier eşliğinde 5 kap tadım menüsü.', now() + interval '9 days', 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=80', true, 1200, 20),
    ('b0000000-0000-4000-8000-000000000007', 'e0000000-0000-4000-8000-000000000004', 'Zeytinyağı Atölyesi', 'Yerel üreticiyle zeytinyağı tadım atölyesi, ücretsiz.', now() + interval '11 days', 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=1200&q=80', false, null, 30),
    ('b0000000-0000-4000-8000-000000000008', 'e0000000-0000-4000-8000-000000000003', 'DJ Set — Sezon Kapanışı', 'Kontenjanı dolu — bekleme listesi için işletmeyle iletişime geç.', now() + interval '13 days', 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1200&q=80', true, 950, 5)
  on conflict (id) do nothing;

  -- ---------------------------------------------------------------
  -- 5) ~30 DEMO KULLANICI
  -- ---------------------------------------------------------------
  for v_i in 1..30 loop
    v_user_id := ('c0000000-0000-4000-8000-' || lpad(v_i::text, 12, '0'))::uuid;

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
      'demo.u' || lpad(v_i::text, 2, '0') || '@locally.test',
      crypt('DemoPilot2026!', gen_salt('bf')), now(), now(), now(),
      '{"provider":"email","providers":["email"]}',
      ('{"full_name":"Demo Kullanıcı ' || v_i || '"}')::jsonb,
      false, '', '', '', ''
    )
    on conflict (id) do nothing;

    insert into profiles (id, full_name, phone, role, is_demo)
    values (v_user_id, 'Demo Kullanıcı ' || v_i, '05' || (400000000 + v_i)::text, 'user', true)
    on conflict (id) do nothing;
  end loop;

  -- ---------------------------------------------------------------
  -- 6) GEÇMİŞE DÖNÜK REZERVASYON + KULLANIM GEÇMİŞİ
  --    Her demo kullanıcı rastgele bir pakete rezervasyon yapar; bir kısmı
  --    hâlâ 'reserved' (ödeme bekliyor), bir kısmı 'completed' (aktif/
  --    kullanılmış) ve kullanım geçmişi son 7 güne yayılır.
  -- ---------------------------------------------------------------
  for v_i in 1..30 loop
    v_user_id := ('c0000000-0000-4000-8000-' || lpad(v_i::text, 12, '0'))::uuid;
    v_package_id := v_package_ids[1 + (v_i % array_length(v_package_ids, 1))];

    insert into purchases (id, user_id, package_id, amount, status, provider_status, created_at)
    values (
      ('d1000000-0000-4000-8000-' || lpad(v_i::text, 12, '0'))::uuid,
      v_user_id,
      v_package_id,
      450,
      case when v_i % 4 = 0 then 'reserved' else 'completed' end,
      case when v_i % 4 = 0 then 'pay_at_venue' else 'pay_at_venue' end,
      now() - ((v_i % 7) || ' days')::interval
    )
    on conflict (id) do nothing;
  end loop;

  -- Az önce oluşturulan 'completed' rezervasyonların haklarından bir kısmını
  -- kullanılmış say (redemption geçmişi + remaining_uses düşürme), son 7
  -- güne yayarak grafiklerin dolu görünmesini sağla.
  for v_pkg in
    select e.id as entitlement_id, e.remaining_uses, p.business_id, pu.created_at
    from entitlements e
    join purchases pu on pu.id = e.purchase_id
    join packages p on p.id = pu.package_id
    where pu.user_id in (select id from profiles where is_demo)
      and pu.status = 'completed'
  loop
    v_days_ago := random() * 7;

    update entitlements
    set remaining_uses = greatest(remaining_uses - 1, 0),
        status = (case when remaining_uses - 1 <= 0 then 'used' else 'active' end)::entitlement_status
    where id = v_pkg.entitlement_id;

    insert into redemptions (entitlement_id, business_id, redeemed_at, verified_by)
    select v_pkg.entitlement_id, v_pkg.business_id, now() - (v_days_ago || ' days')::interval, b.owner_id
    from businesses b where b.id = v_pkg.business_id
    on conflict do nothing;
  end loop;

  -- ---------------------------------------------------------------
  -- 7) "DJ Set — Sezon Kapanışı" etkinliğinin kontenjanını doldur (5/5)
  -- ---------------------------------------------------------------
  for v_i in 1..5 loop
    insert into tickets (id, event_id, user_id, status, price_paid)
    values (
      ('b1000000-0000-4000-8000-' || lpad(v_i::text, 12, '0'))::uuid,
      'b0000000-0000-4000-8000-000000000008',
      ('c0000000-0000-4000-8000-' || lpad(v_i::text, 12, '0'))::uuid,
      'active',
      950
    )
    on conflict (id) do nothing;
  end loop;

  return jsonb_build_object(
    'success', true,
    'businesses', 12,
    'users', 30
  );
end;
$$;

revoke all on function public.admin_load_demo_data() from public;
grant execute on function public.admin_load_demo_data() to authenticated;

-- ==== supabase/migrations/20260725000100_demo_data_load.sql SONU ====


-- ============================================================================
-- KAYNAK DOSYA: supabase/migrations/20260820000000_admin_role_sync.sql
-- ============================================================================

-- admin_emails beyaz listesi yalnızca YENİ kayıt/girişlerde uygulanıyordu
-- (bkz. lib/auth/ensure-profile.ts). Bu migration, listeye eklenmiş ama
-- daha önce zaten normal kullanıcı olarak kayıt olmuş hesapları da tek
-- seferlik olarak admin'e yükseltir — böylece dashboard'dan admin_emails'e
-- yeni bir satır eklemek, kullanıcının tekrar giriş yapmasını beklemeden
-- hemen etkili olur (uygulama tarafı zaten her girişte de senkronize eder).
update profiles p
set role = 'admin'
from auth.users u
join admin_emails ae on ae.email = lower(trim(u.email))
where p.id = u.id
  and p.role <> 'admin';

-- ==== supabase/migrations/20260820000000_admin_role_sync.sql SONU ====


-- ============================================================================
-- KAYNAK DOSYA: supabase/migrations/20260820000100_test_lab.sql
-- ============================================================================

-- =============================================================================
-- TEST LAB — P23: pilotu tek kişi/tek telefonla test edebilmek için sabit
-- hesaplar, sabit QR senaryoları (geçerli + 4 bilinçli hatalı) ve tek tık
-- simülasyon fonksiyonları.
--
-- Demo veri setinden (admin panelinden yüklenen/temizlenen, is_demo=true
-- olan 12 işletme) BAĞIMSIZDIR: o veri admin tarafından istenildiğinde
-- silinebildiği için test lab'ın kendi sabit, hep var olan fixture'ları var.
-- Sabit (rastgele değil) UUID'ler + ON CONFLICT DO NOTHING sayesinde bu
-- migration tekrar çalıştırılsa da hata vermez.
--
-- Test lab hesap şifresi: TestLab2026!
-- =============================================================================

create extension if not exists pgcrypto;

-- is_test_fixture: is_demo'dan bilinçli olarak AYRI bir bayrak. is_demo=true
-- satırlar admin panelindeki "Demo Verisini Temizle" düğmesiyle silinebilir;
-- test lab hesapları ise pilot boyunca hep var olmalı, o düğmeden etkilenmemeli.
-- Bu bayrak yalnızca herkese açık keşif sorgularından (kesfet/bu-aksam/
-- etkinlikler) test işletmelerini gizlemek için kullanılır — panel, admin ve
-- verify_code() akışları bu bayrağı hiç kontrol etmez, tam işlevsel kalır.
alter table businesses add column if not exists is_test_fixture boolean not null default false;
create index if not exists idx_businesses_is_test_fixture on businesses (is_test_fixture) where is_test_fixture;

-- ---------------------------------------------------------------------------
-- 1) Hesaplar: admin, işletme sahibi, kullanıcı + "komşu" işletme sahibi
--    (WRONG_BUSINESS senaryosu için, ayrı bir işletmeye ihtiyaç var)
-- ---------------------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  ('00000000-0000-0000-0000-000000000000', '99990000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'test.admin@locally.test', crypt('TestLab2026!', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Test Admin"}', false, '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '99990000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'test.isletme@locally.test', crypt('TestLab2026!', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Test İşletme Sahibi"}', false, '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '99990000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'test.kullanici@locally.test', crypt('TestLab2026!', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Test Kullanıcı"}', false, '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '99990000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'test.komsu@locally.test', crypt('TestLab2026!', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Komşu İşletme Sahibi"}', false, '', '', '', '')
on conflict (id) do nothing;

-- ÖNEMLİ: is_demo=false (varsayılan) bırakılıyor — is_demo=true olsaydı admin
-- panelindeki "Demo Verisini Temizle" düğmesi bu hesapları da (auth.users
-- dahil) silerdi. Test lab hesapları demo veri döngüsünden tamamen bağımsız.
insert into profiles (id, full_name, role) values
  ('99990000-0000-4000-8000-000000000001', 'Test Admin', 'admin'),
  ('99990000-0000-4000-8000-000000000002', 'Test İşletme Sahibi', 'business'),
  ('99990000-0000-4000-8000-000000000003', 'Test Kullanıcı', 'user'),
  ('99990000-0000-4000-8000-000000000004', 'Komşu İşletme Sahibi', 'business')
on conflict (id) do update set role = excluded.role;

-- ---------------------------------------------------------------------------
-- 2) İşletmeler — onaylı, logo+kapak fotoğrafı dolu (sihirbaza düşmesin)
-- ---------------------------------------------------------------------------

insert into businesses (
  id, owner_id, name, slug, description, category, city, district, phone,
  approval_status, iyzico_onboarding_status, cover_url, logo_url, is_test_fixture
) values
  ('99990001-0000-4000-8000-000000000001', '99990000-0000-4000-8000-000000000002',
   'Test İşletmesi', 'test-isletmesi', 'Test Lab için sabit işletme hesabı — panel testleri burada yapılır.',
   'kafe', 'Bodrum', 'Merkez', '05320000001', 'approved', 'approved',
   'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=1200&q=80',
   'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=200&q=80', true),
  ('99990001-0000-4000-8000-000000000002', '99990000-0000-4000-8000-000000000004',
   'Komşu İşletme (Test)', 'komsu-isletme-test', 'WRONG_BUSINESS senaryosunu göstermek için ikinci sabit işletme.',
   'restoran', 'Bodrum', 'Merkez', '05320000002', 'approved', 'approved',
   'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=80',
   'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=200&q=80', true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 3) Paketler — geçerli, süresi (baştan) dolmuş, komşuya ait, + simülasyon
--    hedefi (başlangıçta geçerli, "süresini dolmuş yap" düğmesi bunu bozar)
-- ---------------------------------------------------------------------------

insert into packages (id, business_id, title, description, sale_price, summer_reference_price, usage_count, expires_at, quota, sold_count, is_active) values
  ('99990002-0000-4000-8000-000000000001', '99990001-0000-4000-8000-000000000001',
   'Test Paketi — Geçerli', '5 kullanımlık test paketi.', 350, 700, 5, now() + interval '60 days', null, 0, true),
  ('99990002-0000-4000-8000-000000000002', '99990001-0000-4000-8000-000000000001',
   'Test Paketi — Süresi Dolmuş', 'Bilerek süresi geçmiş test paketi.', 350, 700, 3, now() - interval '3 days', null, 0, true),
  ('99990002-0000-4000-8000-000000000003', '99990001-0000-4000-8000-000000000001',
   'Test Paketi — Simülasyon Hedefi', '"Paketin süresini dolmuş yap" düğmesi bu paketi hedefler.', 350, 700, 4, now() + interval '60 days', null, 0, true),
  ('99990002-0000-4000-8000-000000000004', '99990001-0000-4000-8000-000000000002',
   'Komşu Paket', 'Komşu İşletme''ye ait paket — WRONG_BUSINESS senaryosu için.', 300, 600, 3, now() + interval '60 days', null, 0, true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 4) Satın alımlar (status='completed' → entitlement + QR otomatik oluşur,
--    bkz. trg_purchases_create_entitlement)
-- ---------------------------------------------------------------------------

insert into purchases (id, user_id, package_id, amount, status, provider_status) values
  ('99990003-0000-4000-8000-000000000001', '99990000-0000-4000-8000-000000000003', '99990002-0000-4000-8000-000000000001', 350, 'completed', 'pay_at_venue'),
  ('99990003-0000-4000-8000-000000000002', '99990000-0000-4000-8000-000000000003', '99990002-0000-4000-8000-000000000001', 350, 'completed', 'pay_at_venue'),
  ('99990003-0000-4000-8000-000000000003', '99990000-0000-4000-8000-000000000003', '99990002-0000-4000-8000-000000000002', 350, 'completed', 'pay_at_venue'),
  ('99990003-0000-4000-8000-000000000004', '99990000-0000-4000-8000-000000000003', '99990002-0000-4000-8000-000000000004', 300, 'completed', 'pay_at_venue'),
  ('99990003-0000-4000-8000-000000000005', '99990000-0000-4000-8000-000000000003', '99990002-0000-4000-8000-000000000003', 350, 'completed', 'pay_at_venue')
on conflict (id) do nothing;

-- İkinci satın alımın (…002) hakkını tüket → NO_USES_LEFT senaryosu.
update entitlements
set remaining_uses = 0, status = 'used'
where purchase_id = '99990003-0000-4000-8000-000000000002';

-- ---------------------------------------------------------------------------
-- 5) Bu Akşam flaş fırsatı + geçerli ayırtma (diğer kod tipini de göstermek
--    için) — "kontenjanı doldur" / "flaşı bitir" düğmelerinin hedefi.
-- ---------------------------------------------------------------------------

insert into flash_deals (id, business_id, offer_text, starts_at, ends_at, total_quota, remaining_quota, is_active) values
  ('99990004-0000-4000-8000-000000000001', '99990001-0000-4000-8000-000000000001',
   'Test Lab flaş fırsatı — bu akşam %30 indirim', now() - interval '30 minutes', now() + interval '6 hours', 10, 4, true)
on conflict (id) do nothing;

insert into flash_deal_reservations (id, flash_deal_id, user_id, confirmation_code, status)
values (
  '99990005-0000-4000-8000-000000000001',
  '99990004-0000-4000-8000-000000000001',
  '99990000-0000-4000-8000-000000000003',
  'FLATEST1',
  'active'
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 6) Etkinlik + geçerli bilet (üçüncü kod tipini göstermek için)
-- ---------------------------------------------------------------------------

insert into events (id, business_id, title, description, event_at, is_paid, ticket_price, capacity) values
  ('99990006-0000-4000-8000-000000000001', '99990001-0000-4000-8000-000000000001',
   'Test Lab Etkinliği', 'QR doğrulamayı bilet üzerinde test etmek için.', now() + interval '5 days', false, null, 50)
on conflict (id) do nothing;

insert into tickets (id, event_id, user_id, status, price_paid) values
  ('99990007-0000-4000-8000-000000000001', '99990006-0000-4000-8000-000000000001', '99990000-0000-4000-8000-000000000003', 'active', null)
on conflict (id) do nothing;

-- =============================================================================
-- SİMÜLASYON FONKSİYONLARI — hepsi admin'e özel (is_admin()), sabit test lab
-- fixture'larını hedefler, parametre almaz (tek tık).
-- =============================================================================

create or replace function public.admin_test_new_reservation()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := gen_random_uuid();
  v_code text;
begin
  if not is_admin() then raise exception 'FORBIDDEN'; end if;

  insert into purchases (id, user_id, package_id, amount, status, provider_status)
  values (v_id, '99990000-0000-4000-8000-000000000003', '99990002-0000-4000-8000-000000000001', 350, 'completed', 'pay_at_venue');

  select qr_code into v_code from entitlements where purchase_id = v_id;
  return jsonb_build_object('success', true, 'purchase_id', v_id, 'qr_code', v_code);
end;
$$;

create or replace function public.admin_test_expire_package()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'FORBIDDEN'; end if;

  update packages set expires_at = now() - interval '1 hour'
  where id = '99990002-0000-4000-8000-000000000003';

  return jsonb_build_object('success', true);
end;
$$;

create or replace function public.admin_test_fill_flash_quota()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'FORBIDDEN'; end if;

  update flash_deals set remaining_quota = 0
  where id = '99990004-0000-4000-8000-000000000001';

  return jsonb_build_object('success', true);
end;
$$;

create or replace function public.admin_test_end_flash()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'FORBIDDEN'; end if;

  update flash_deals set ends_at = now() - interval '1 minute', is_active = false
  where id = '99990004-0000-4000-8000-000000000001';

  return jsonb_build_object('success', true);
end;
$$;

create or replace function public.admin_test_add_historical_verification()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'FORBIDDEN'; end if;

  insert into verification_logs (business_id, code, code_type, result, customer_name, detail, verified_by, created_at)
  values (
    '99990001-0000-4000-8000-000000000001',
    'LCL' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6)),
    'package', 'success', 'Test Kullanıcı', 'Geçmişe dönük simülasyon kaydı',
    '99990000-0000-4000-8000-000000000002',
    now() - (floor(random() * 5) + 1 || ' days')::interval
  );

  return jsonb_build_object('success', true);
end;
$$;

create or replace function public.admin_test_set_business_pending()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'FORBIDDEN'; end if;

  update businesses set approval_status = 'pending'
  where id = '99990001-0000-4000-8000-000000000001';

  return jsonb_build_object('success', true);
end;
$$;

-- Test Lab fixture'larını ilk haline sıfırlar (deneyleri tekrarlanabilir
-- kılmak için) — demo veri setine ya da gerçek kullanıcı verisine dokunmaz.
create or replace function public.admin_test_reset_lab_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'FORBIDDEN'; end if;

  update businesses set approval_status = 'approved'
  where id = '99990001-0000-4000-8000-000000000001';

  update packages set expires_at = now() + interval '60 days'
  where id = '99990002-0000-4000-8000-000000000003';

  update flash_deals set remaining_quota = 4, ends_at = now() + interval '6 hours', is_active = true
  where id = '99990004-0000-4000-8000-000000000001';

  delete from purchases
  where user_id = '99990000-0000-4000-8000-000000000003'
    and package_id = '99990002-0000-4000-8000-000000000001'
    and id <> '99990003-0000-4000-8000-000000000001';

  delete from verification_logs
  where business_id = '99990001-0000-4000-8000-000000000001'
    and detail = 'Geçmişe dönük simülasyon kaydı';

  return jsonb_build_object('success', true);
end;
$$;

revoke all on function public.admin_test_new_reservation() from public;
revoke all on function public.admin_test_expire_package() from public;
revoke all on function public.admin_test_fill_flash_quota() from public;
revoke all on function public.admin_test_end_flash() from public;
revoke all on function public.admin_test_add_historical_verification() from public;
revoke all on function public.admin_test_set_business_pending() from public;
revoke all on function public.admin_test_reset_lab_data() from public;

grant execute on function public.admin_test_new_reservation() to authenticated;
grant execute on function public.admin_test_expire_package() to authenticated;
grant execute on function public.admin_test_fill_flash_quota() to authenticated;
grant execute on function public.admin_test_end_flash() to authenticated;
grant execute on function public.admin_test_add_historical_verification() to authenticated;
grant execute on function public.admin_test_set_business_pending() to authenticated;
grant execute on function public.admin_test_reset_lab_data() to authenticated;

-- ==== supabase/migrations/20260820000100_test_lab.sql SONU ====

