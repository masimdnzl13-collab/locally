-- =============================================================================
-- P27 — ÇOKLU ROL VE DASHBOARD SEÇİM EKRANI
--
-- Rol sistemi tek değerli kalmaya devam ediyor (profiles.role hâlâ tekil,
-- kayıt/onay/admin-beyaz-listesi akışları hiç değişmedi) — üstüne, yalnızca
-- ELLE ve İSİM BAZLI izin verilen hesaplara ek roller tanımlayan yeni bir
-- additional_roles sütunu ekleniyor. Bu, "profiles tablosuna ek roller
-- tutan bir alan" ile "ayrı bir kullanıcı-rol tablosu" arasındaki tercih
-- sorusunun cevabı: dizi sütunu seçildi çünkü (a) tek bir kullanıcının en
-- fazla 3 rolü olabilir, ayrı bir tabloya gerek bırakmayacak kadar küçük
-- bir küme, (b) mevcut tüm RLS fonksiyonları zaten profiles satırına bakıyor
-- — is_admin() gibi merkezi tek bir fonksiyonu güncellemek, düzinelerce
-- policy'yi ayrı ayrı değiştirmekten çok daha az riskli.
--
-- GÜVENLİK: additional_roles sütununa normal bir kullanıcı (authenticated
-- rolü) asla UPDATE atamaz — aşağıda kolon bazlı REVOKE ile kilitleniyor.
-- Bu, RLS'in row bazlı olmasının ötesinde bir katman: profiles_update_own_or_admin
-- policy'si kendi satırını güncellemeye izin verse bile, Postgres bu
-- spesifik sütuna dokunan HİÇBİR UPDATE'e (server action'dan gelen dahil
-- değil — yalnızca service_role/superuser bypass eder) izin vermez.
-- =============================================================================

alter table profiles add column if not exists additional_roles user_role[] not null default '{}';

revoke update (additional_roles) on profiles from authenticated;

-- is_admin() artık role='admin' YA DA additional_roles içinde 'admin' varsa
-- true döner — böylece çok rollü bir hesap admin moduna geçtiğinde RLS
-- tarafında da GERÇEKTEN admin sayılır, sahte bir arayüz numarası değil.
-- owns_business() zaten sahiplik bazlı (role'e hiç bakmıyor), bu yüzden
-- işletme moduna geçiş için ayrıca değiştirilmesi gereken bir şey yok —
-- aşağıda oluşturulan işletme satırının owner_id'si doğru hesaba
-- bağlandığı an, o hesap zaten gerçek sahibi olur.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and (role = 'admin' or 'admin' = any(additional_roles))
  );
$$;

-- Tek, elle onaylanmış hesap: m.asimdnzl13@gmail.com'un birincil rolü
-- (admin) değişmiyor, üstüne 'user' ve 'business' ekleniyor. Bu UPDATE
-- superuser/service bağlamında (migration) çalıştığı için yukarıdaki
-- REVOKE'tan etkilenmez.
update profiles p
set additional_roles = array['user', 'business']::user_role[]
from auth.users u
where p.id = u.id
  and lower(trim(u.email)) = 'm.asimdnzl13@gmail.com'
  and p.additional_roles is distinct from array['user', 'business']::user_role[];

-- =============================================================================
-- Bu hesaba bağlı, onaylı, kurgusal bir "kalıcı test işletmesi" — panel
-- boş görünmesin diye birkaç paket + 1 etkinlik + 1 flaş fırsatıyla.
-- is_test_fixture=true: Test Lab hesaplarıyla AYNI koruma — hem admin
-- panelindeki "Demo Verisini Temizle" düğmesi bunu asla silmez (o yalnızca
-- is_demo=true satırlara bakar), hem de varsayılan olarak herkese açık
-- keşfet/bu-akşam/etkinlikler listelerinden gizli kalır (o sorgular zaten
-- is_test_fixture=false şartı arıyor). Görünür yapmak istersen:
--   update businesses set is_test_fixture = false where slug = 'rihtim-deneme-kafe';
-- =============================================================================

insert into businesses (
  id, owner_id, name, slug, description, category, city, district, phone,
  approval_status, iyzico_onboarding_status, cover_url, logo_url, is_test_fixture
)
select
  'ad000000-0000-4000-8000-000000000001'::uuid,
  u.id,
  'Rıhtım Deneme Kafe',
  'rihtim-deneme-kafe',
  'Admin hesabına bağlı, kalıcı test/deneme işletmesi — panel özelliklerini gerçek bir işletme gibi denemek için.',
  'kafe',
  'Bodrum',
  'Merkez',
  '05320000099',
  'approved',
  'approved',
  'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1200&q=80',
  'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=200&q=80',
  true
from auth.users u
where lower(trim(u.email)) = 'm.asimdnzl13@gmail.com'
on conflict (id) do nothing;

insert into packages (id, business_id, title, description, sale_price, summer_reference_price, usage_count, expires_at, quota, sold_count, is_active) values
  ('ad000001-0000-4000-8000-000000000001', 'ad000000-0000-4000-8000-000000000001',
   'Rıhtım Kahve Paketi', '5 kullanımlık filtre kahve / espresso paketi.', 400, 800, 5, now() + interval '90 days', null, 0, true),
  ('ad000001-0000-4000-8000-000000000002', 'ad000000-0000-4000-8000-000000000001',
   'Rıhtım Kahvaltı Paketi', '2 kişilik açık büfe kahvaltı, 1 kullanım.', 900, 1800, 1, now() + interval '90 days', 30, 0, true)
on conflict (id) do nothing;

insert into events (id, business_id, title, description, event_at, is_paid, ticket_price, capacity) values
  ('ad000002-0000-4000-8000-000000000001', 'ad000000-0000-4000-8000-000000000001',
   'Rıhtım Akşamı', 'Deneme işletmesinde canlı müzik eşliğinde akşam buluşması.', now() + interval '10 days', true, 300, 40)
on conflict (id) do nothing;

insert into flash_deals (id, business_id, offer_text, starts_at, ends_at, total_quota, remaining_quota, is_active) values
  ('ad000003-0000-4000-8000-000000000001', 'ad000000-0000-4000-8000-000000000001',
   'Bu akşam kahve %30 indirimli', now() - interval '30 minutes', now() + interval '6 hours', 15, 9, true)
on conflict (id) do nothing;

-- Bu migration'ın kendisi.
insert into public.schema_migrations_log (filename, note)
values ('20260821000000_multi_role.sql', 'bu çalıştırmada uygulandı')
on conflict (filename) do nothing;
