-- P28 — İşletme kayıt akışının sadeleştirilmesi ve rehberli onboarding.
-- Kayıt artık yalnızca e-posta + şifre + işletme adı istiyor; businesses
-- satırı doğrudan kayıt anında oluşuyor (bkz. lib/business/ensure-business.ts).
-- Geri kalan kurulum adımları (işletme bilgileri, görseller, ilk paket,
-- QR standı) panelin ana sayfasındaki rehberli kontrol listesinde takip
-- ediliyor. İlk üç adımın tamamlanma durumu zaten var olan kolonlardan
-- (district/address/phone, logo_url/cover_url, packages satırı) türetiliyor
-- — yalnızca "QR standı görüntülendi" sinyali için yeni bir kolon gerekiyor.

alter table businesses add column if not exists qr_stand_viewed_at timestamptz;

-- Panele ilk girişte gösterilen "şifreni güçlendir" hatırlatmasının
-- kapatılma zamanı. NULL = henüz kapatılmadı, hatırlatma gösterilmeye devam eder.
alter table businesses add column if not exists password_reminder_dismissed_at timestamptz;

-- GERİYE DÖNÜK UYUMLULUK: eski (P28 öncesi) kurulum sihirbazını tamamlamış
-- işletmeler için her iki yeni alanı da "zaten tamam" say — aksi halde
-- gerçek, çoktan yayında olan işletmeler bir sonraki girişte aniden yeniden
-- görünen bir kurulum listesiyle ve gereksiz bir şifre hatırlatmasıyla
-- karşılaşır. Yeni kayıtlar bu migration'dan sonra oluştuğu için bu UPDATE'ler
-- onları hiç etkilemez (satırları bu ALTER'lardan SONRA insert edilir).
update businesses
set qr_stand_viewed_at = coalesce(qr_stand_viewed_at, created_at)
where logo_url is not null and cover_url is not null and qr_stand_viewed_at is null;

update businesses
set password_reminder_dismissed_at = coalesce(password_reminder_dismissed_at, created_at)
where password_reminder_dismissed_at is null;

-- Admin'in "hesabını açmış ama kurulumunu tamamlamamış" işletmeleri takip
-- edebilmesi için — auth.users.last_sign_in_at ve e-postasına ihtiyaç
-- duyduğundan (client'tan doğrudan okunamaz) admin_legacy_businesses ile
-- aynı SECURITY DEFINER RPC deseni kullanılıyor.
create or replace function public.admin_onboarding_incomplete_businesses()
returns table (
  id uuid,
  name text,
  created_at timestamptz,
  district text,
  address text,
  phone text,
  logo_url text,
  cover_url text,
  qr_stand_viewed_at timestamptz,
  has_package boolean,
  owner_email text,
  owner_phone text,
  owner_full_name text,
  last_sign_in_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'FORBIDDEN: Yalnızca admin görebilir';
  end if;

  return query
  select
    b.id, b.name, b.created_at, b.district, b.address, b.phone,
    b.logo_url, b.cover_url, b.qr_stand_viewed_at,
    exists(select 1 from packages p where p.business_id = b.id) as has_package,
    u.email::text, pr.phone, pr.full_name, u.last_sign_in_at
  from businesses b
  join auth.users u on u.id = b.owner_id
  join profiles pr on pr.id = b.owner_id
  where not b.is_demo
    and not b.is_test_fixture
    and not (
      b.district is not null and b.address is not null and b.phone is not null
      and b.logo_url is not null and b.cover_url is not null
      and exists(select 1 from packages p2 where p2.business_id = b.id)
      and b.qr_stand_viewed_at is not null
    )
  order by b.created_at desc;
end;
$$;

revoke all on function public.admin_onboarding_incomplete_businesses() from public;
grant execute on function public.admin_onboarding_incomplete_businesses() to authenticated;

insert into public.schema_migrations_log (filename, note)
values ('20260821000200_onboarding_checklist.sql', 'bu çalıştırmada uygulandı')
on conflict (filename) do nothing;
