-- Demo veri seti: Bodrum'da 12 kurgusal işletme, paketler, flaş fırsatlar,
-- etkinlikler ve ~30 demo kullanıcı üzerinden geçmiş hareket. Tüm kurgusal
-- isimler gerçek işletmelerle örtüşmeyecek şekilde uydurulmuştur. Her satır
-- is_demo=true (veya demo işletme/kullanıcıya bağlı) olduğu için
-- admin_clear_demo_data() ile güvenle geri alınabilir. Sabit UUID + ON
-- CONFLICT DO NOTHING sayesinde fonksiyon tekrar çağrılsa da hata vermez.
--
-- GİRİŞ YAPILAMAZ HESAPLAR: bu 12 işletme + 30 kullanıcının tek işi
-- keşfet/panel/admin ekranlarındaki listeleri, müşteri geçmişini ve
-- grafikleri gerçekçi görünecek şekilde doldurmak — hiçbiriyle giriş
-- yapılması gerekmiyor (giriş gerektiren tek test hesapları
-- /test-lab-k7m2p9x4 sayfasındaki 3 sabit hesap, bkz. test_lab.sql).
-- Bu yüzden encrypted_password bilinçli olarak NULL bırakılıyor: hem
-- crypt()/gen_salt() (pgcrypto) çağırma ve şema/arama yolu bağımlılığını
-- tamamen ortadan kaldırıyor, hem de auth şemasının iç yapısına daha az
-- bağımlı, daha sağlam bir yöntem. NULL şifreli bir auth.users satırı
-- Supabase'te geçerlidir (ör. yalnızca magic link ile giren kullanıcılarda
-- da böyledir) — signInWithPassword bu hesaplar için her zaman "Invalid
-- login credentials" döner, hesaplar başka hiçbir şekilde etkilenmez.

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
    ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'demo.b01@locally.test', null, now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Demo İşletme 1"}', false, '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'demo.b02@locally.test', null, now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Demo İşletme 2"}', false, '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'demo.b03@locally.test', null, now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Demo İşletme 3"}', false, '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'demo.b04@locally.test', null, now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Demo İşletme 4"}', false, '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'demo.b05@locally.test', null, now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Demo İşletme 5"}', false, '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'demo.b06@locally.test', null, now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Demo İşletme 6"}', false, '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-4000-8000-000000000007', 'authenticated', 'authenticated', 'demo.b07@locally.test', null, now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Demo İşletme 7"}', false, '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-4000-8000-000000000008', 'authenticated', 'authenticated', 'demo.b08@locally.test', null, now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Demo İşletme 8"}', false, '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-4000-8000-000000000009', 'authenticated', 'authenticated', 'demo.b09@locally.test', null, now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Demo İşletme 9"}', false, '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-4000-8000-000000000010', 'authenticated', 'authenticated', 'demo.b10@locally.test', null, now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Demo İşletme 10"}', false, '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-4000-8000-000000000011', 'authenticated', 'authenticated', 'demo.b11@locally.test', null, now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Demo İşletme 11"}', false, '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-4000-8000-000000000012', 'authenticated', 'authenticated', 'demo.b12@locally.test', null, now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Demo İşletme 12"}', false, '', '', '', '')
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
      null, now(), now(), now(),
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
