-- Locally — demo/seed verisi
-- ============================================================================
-- Bu script GERÇEK ürün amacıyla yazılmadı; tasarımı ve konum sistemini
-- gerçek verilerle görebilmen için 6 örnek işletme, paket, flaş fırsat ve
-- etkinlik oluşturur. 4 farklı sezonluk rotaya (Bodrum, Alaçatı, Çeşme,
-- Marmaris) dağıtılmıştır, böylece navbar'daki konum seçiciyi değiştirdiğinde
-- içeriğin gerçekten değiştiğini görürsün.
--
-- BİLEREK EKLENMEYENLER: yıldız puanı, yorum sayısı, "kaç kişi görüntüledi",
-- katılımcı sayısı gibi hiçbir alan yok — çünkü şemada bu verileri tutan
-- bir tablo yok. Bu script hiçbir yerde böyle bir alan doldurmuyor; kartlar
-- bu verileri zaten göstermiyor.
--
-- ÇALIŞTIRMA: Supabase Dashboard → SQL Editor → bu dosyanın tamamını
-- yapıştır → Run. Sabit (rastgele değil) UUID'ler kullanıldığı için script
-- tekrar çalıştırıldığında hata vermez (ON CONFLICT DO NOTHING).
--
-- TEMİZLEME: Bu demo verisini silmek istersen, aşağıdaki id'lerle eşleşen
-- satırları businesses tablosundan silmen yeterli (packages/flash_deals/
-- events "on delete cascade" ile otomatik silinir). auth.users satırlarını
-- ayrıca Authentication → Users ekranından silebilirsin.
--
-- ⚠️ Gerçek kullanıcıların karşısına çıkmasını istemiyorsan, gerçek
-- işletmeler eklenene kadar bu demo işletmeleri approval_status='pending'
-- yaparak gizli tutabilirsin.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1) Demo işletme sahibi hesapları (auth.users + profiles)
-- ----------------------------------------------------------------------------
-- Ortak demo şifresi: Locally2026! (yalnız test amaçlı — gerçek kullanıcı
-- girişi için kullanılmayacak demo hesaplardır).

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111101', 'authenticated', 'authenticated', 'demo.limankafe@locally.app', crypt('Locally2026!', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Liman Kafe Demo"}', false, '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111102', 'authenticated', 'authenticated', 'demo.ruzgarsofrasi@locally.app', crypt('Locally2026!', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Rüzgar Sofrası Demo"}', false, '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111103', 'authenticated', 'authenticated', 'demo.alacatisorf@locally.app', crypt('Locally2026!', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Alaçatı Sörf Demo"}', false, '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111104', 'authenticated', 'authenticated', 'demo.taskonak@locally.app', crypt('Locally2026!', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Taş Konak Demo"}', false, '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111105', 'authenticated', 'authenticated', 'demo.cesmebeach@locally.app', crypt('Locally2026!', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Çeşme Beach Demo"}', false, '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111106', 'authenticated', 'authenticated', 'demo.marmarisbalik@locally.app', crypt('Locally2026!', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Marmaris Balık Demo"}', false, '', '', '', '')
on conflict (id) do nothing;

insert into profiles (id, full_name, role) values
  ('11111111-1111-4111-8111-111111111101', 'Liman Kafe Demo', 'business'),
  ('11111111-1111-4111-8111-111111111102', 'Rüzgar Sofrası Demo', 'business'),
  ('11111111-1111-4111-8111-111111111103', 'Alaçatı Sörf Demo', 'business'),
  ('11111111-1111-4111-8111-111111111104', 'Taş Konak Demo', 'business'),
  ('11111111-1111-4111-8111-111111111105', 'Çeşme Beach Demo', 'business'),
  ('11111111-1111-4111-8111-111111111106', 'Marmaris Balık Demo', 'business')
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 2) İşletmeler — onaylı ve satın almaya açık (iyzico_onboarding_status)
-- ----------------------------------------------------------------------------

insert into businesses (
  id, owner_id, name, slug, description, category, city, district,
  approval_status, iyzico_onboarding_status, cover_url
) values
  ('22222222-2222-4222-8222-222222222201', '11111111-1111-4111-8111-111111111101',
   'Liman Kafe', 'liman-kafe-bodrum', 'Bodrum limanında, sabah kahvesi ve el yapımı tatlılarıyla bilinen küçük bir kafe.',
   'kafe', 'Bodrum', 'Gümbet', 'approved', 'approved',
   'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=1200&q=80'),

  ('22222222-2222-4222-8222-222222222202', '11111111-1111-4111-8111-111111111102',
   'Rüzgar Sofrası', 'ruzgar-sofrasi-yalikavak', 'Yalıkavak''ta deniz mahsulleri ve ev yapımı mezeleriyle öne çıkan bir restoran.',
   'restoran', 'Bodrum', 'Yalıkavak', 'approved', 'approved',
   'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=80'),

  ('22222222-2222-4222-8222-222222222203', '11111111-1111-4111-8111-111111111103',
   'Alaçatı Sörf Okulu', 'alacati-sorf-okulu', 'Alaçatı''nın rüzgarlı koylarında yeni başlayanlar için rüzgar sörfü dersleri.',
   'aktivite', 'Alaçatı', 'Alaçatı', 'approved', 'approved',
   'https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=1200&q=80'),

  ('22222222-2222-4222-8222-222222222204', '11111111-1111-4111-8111-111111111104',
   'Taş Konak Alaçatı', 'tas-konak-alacati', 'Alaçatı taş evlerinden restore edilmiş, avlulu butik bir konaklama.',
   'otel', 'Alaçatı', 'Alaçatı', 'approved', 'approved',
   'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200&q=80'),

  ('22222222-2222-4222-8222-222222222205', '11111111-1111-4111-8111-111111111105',
   'Çeşme Mavi Beach Club', 'cesme-mavi-beach-club', 'Çeşme sahilinde şezlong, gün boyu müzik ve deniz manzaralı bir beach club.',
   'beach_club', 'Çeşme', 'Çeşme Merkez', 'approved', 'approved',
   'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1200&q=80'),

  ('22222222-2222-4222-8222-222222222206', '11111111-1111-4111-8111-111111111106',
   'Marmaris Balık Sofrası', 'marmaris-balik-sofrasi', 'Marmaris marinaya nazır, günlük balıkla hazırlanan bir aile restoranı.',
   'restoran', 'Marmaris', 'Marina', 'approved', 'approved',
   'https://images.unsplash.com/photo-1544025162-d76694265947?w=1200&q=80')
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 3) Paketler (summer_reference_price her zaman sale_price'tan büyük olmalı)
-- ----------------------------------------------------------------------------

insert into packages (
  id, business_id, title, description, sale_price, summer_reference_price,
  usage_count, expires_at, quota, sold_count
) values
  ('33333333-3333-4333-8333-333333333301', '22222222-2222-4222-8222-222222222201',
   '5 Kahve Paketi', 'Filtre kahve veya espresso bazlı 5 içecek hakkı.',
   350, 700, 5, now() + interval '45 days', null, 0),

  ('33333333-3333-4333-8333-333333333302', '22222222-2222-4222-8222-222222222202',
   'Akşam Yemeği İkramı', '2 kişilik ana yemek + meze tabağı.',
   650, 1600, 1, now() + interval '30 days', 40, 12),

  ('33333333-3333-4333-8333-333333333303', '22222222-2222-4222-8222-222222222203',
   '3 Ders Sörf Paketi', 'Ekipman dahil, eğitmen eşliğinde 3 ders.',
   1200, 2800, 3, now() + interval '60 days', null, 0),

  ('33333333-3333-4333-8333-333333333304', '22222222-2222-4222-8222-222222222204',
   'Gece Konaklama', 'Kahvaltı dahil çift kişilik oda, 1 gece.',
   1800, 3600, 1, now() + interval '90 days', 15, 3),

  ('33333333-3333-4333-8333-333333333305', '22222222-2222-4222-8222-222222222205',
   'Gün Boyu Şezlong + İkram', '2 şezlong + karşılama içeceği.',
   450, 1100, 1, now() + interval '30 days', null, 0),

  ('33333333-3333-4333-8333-333333333306', '22222222-2222-4222-8222-222222222206',
   '2 Kişilik Balık Menü', 'Meze + günün balığı + tatlı.',
   900, 2000, 1, now() + interval '40 days', 25, 8)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 4) Flaş fırsatlar ("Bu Akşam") — Liman Kafe ve Çeşme Mavi Beach Club
-- ----------------------------------------------------------------------------

insert into flash_deals (
  id, business_id, offer_text, starts_at, ends_at, total_quota, remaining_quota
) values
  ('44444444-4444-4444-8444-444444444401', '22222222-2222-4222-8222-222222222201',
   'Bu akşam 2 al 1 öde — filtre kahve',
   now() - interval '30 minutes', now() + interval '5 hours', 20, 14),

  ('44444444-4444-4444-8444-444444444402', '22222222-2222-4222-8222-222222222205',
   'Bu akşam şezlong %50 indirimli',
   now() - interval '1 hour', now() + interval '4 hours', 15, 6)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 5) Etkinlikler
-- ----------------------------------------------------------------------------

insert into events (
  id, business_id, title, description, event_at, is_paid, ticket_price, capacity
) values
  ('55555555-5555-4555-8555-555555555501', '22222222-2222-4222-8222-222222222202',
   'Canlı Müzik Akşamı', 'Akustik canlı müzik eşliğinde akşam yemeği.',
   now() + interval '3 days', true, 250, 60),

  ('55555555-5555-4555-8555-555555555502', '22222222-2222-4222-8222-222222222203',
   'Gün Batımı Sörf Turu', 'Deneyimli sörfçüler için gün batımı turu.',
   now() + interval '5 days', true, 400, 20),

  ('55555555-5555-4555-8555-555555555503', '22222222-2222-4222-8222-222222222206',
   'Marina Balık Pazarı', 'Yerel üreticilerle açık hava balık ve deniz ürünleri pazarı.',
   now() + interval '7 days', false, null, 150)
on conflict (id) do nothing;
