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

-- Supabase projelerinde pgcrypto genellikle "extensions" şemasına kurulur,
-- "public" değil — bu yüzden crypt()/gen_salt() çağrıları şema belirtilmeden
-- yapılırsa "function does not exist" hatası verebilir. Eklentiyi açıkça
-- extensions şemasına kurmayı DENERİZ (zaten başka bir şemada kuruluysa
-- "if not exists" bunu sessizce atlar, hataya sebep olmaz), ve aşağıdaki
-- INSERT'ten hemen önce search_path'i hem public hem extensions'ı
-- kapsayacak şekilde genişletiriz — böylece pgcrypto hangi şemada kurulu
-- olursa olsun (public, extensions, ya da başka bir yerde) crypt()/
-- gen_salt() bulunur. İşlem bitince search_path eski haline döndürülür.
create extension if not exists pgcrypto with schema extensions;

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

set search_path = public, extensions;

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

reset search_path;

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
