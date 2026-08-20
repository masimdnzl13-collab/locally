-- =============================================================================
-- FRESH_DATABASE_SETUP.sql
--
-- KULLANIM ALANI: Supabase projen SİLİNMİŞ ve sıfırdan yeni bir proje
-- kurdun (BOŞ bir veritabanı). Bu dosya repodaki 22 migration dosyasının
-- TAMAMINI, doğru kronolojik sırayla, tek dosyada birleştirir.
--
-- Projen yalnızca DURAKLATILMIŞTI, "Restore" ile geri açtıysan, ya da
-- veritabanının o an tam olarak hangi durumda olduğundan emin değilsen
-- (elle uygulanmış migration'lar yüzünden bu artık tahmin konusu olabiliyor)
-- bu dosya yerine APPLY_PENDING_MIGRATIONS.sql'i kullan.
--
-- ÖNEMLİ — BU DOSYA İLE APPLY_PENDING_MIGRATIONS.sql ARASINDAKİ FARK:
-- gövdedeki (22 migration'ın idempotent hali) SQL birebir aynıdır — ikisi
-- de aynı kaynaktan üretildi ve aynı otomatik denetimden geçirildi (bkz.
-- en alttaki "hiçbir yerde varsayım yok" notu). Tek gerçek fark, bu
-- dosyanın EN BAŞINDA ekstra bir "veritabanı gerçekten boş mu?" güvenlik
-- kilidinin olması. Onun dışında iki dosya da her satırı kendi başına
-- güvenli (if not exists / on conflict do nothing / drop+create) olduğu
-- için boş, kısmen uygulanmış ya da tam uygulanmış her veritabanında
-- sorunsuz çalışır.
--
-- GÜVENLİK KİLİDİ: Bu betik en başta public.profiles tablosunun zaten var
-- olup olmadığını kontrol eder. Varsa (yani veritabanı boş değilse) betik
-- HİÇBİR ŞEY YAPMADAN, açık bir hatayla durur — böylece bunu yanlışlıkla
-- dolu bir veritabanında (ör. iki kez) çalıştırırsan veri bozulmaz, sadece
-- aşağıdaki hatayı görürsün:
--   "ALREADY_INITIALIZED: public.profiles zaten var..."
--
-- ÇALIŞTIRMA: Supabase Dashboard → SQL Editor → bu dosyanın tamamını
-- yapıştır → Run. Hata alırsan, hangi KAYNAK DOSYA yorumunun altında
-- kaldığına bakarak orijinal migration dosyasını repoda bul. En altta,
-- hangi migration'ların uygulandığını gösteren bir özet sorgusu var
-- (public.schema_migrations_log tablosundan, bkz. son bölüm).
-- =============================================================================

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'profiles'
  ) then
    raise exception 'ALREADY_INITIALIZED: public.profiles zaten var — bu betik yalnızca BOŞ bir veritabanında bir kez çalıştırılmalı. Zaten kurulu (ya da duraklatılıp geri açılmış) bir projeye eklenecek migration için APPLY_PENDING_MIGRATIONS.sql dosyasını kullanın.';
  end if;
end $$;

-- ============================================================================
-- KAYNAK DOSYA: supabase/migrations/20260711003340_init_schema.sql
-- ============================================================================

-- Locally — başlangıç şeması ve güvenlik kuralları
-- Tablolar: profiles, businesses, packages, purchases, entitlements,
-- redemptions, flash_deals, events, tickets, announcements, customers

-- =========================================================
-- ENUM TİPLERİ
-- =========================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('user', 'business', 'admin');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'business_category') then
    create type business_category as enum (
      'restoran', 'kafe', 'otel', 'beach_club', 'aktivite', 'diger'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'approval_status') then
    create type approval_status as enum ('pending', 'approved', 'rejected');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'purchase_status') then
    create type purchase_status as enum ('pending', 'completed', 'failed', 'refunded');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'entitlement_status') then
    create type entitlement_status as enum ('active', 'used', 'expired');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'ticket_status') then
    create type ticket_status as enum ('active', 'cancelled', 'used');
  end if;
end $$;

-- =========================================================
-- YARDIMCI FONKSİYONLAR
-- =========================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================================================
-- TABLOLAR
-- =========================================================

-- profiles: auth kullanıcısına 1-1 bağlı profil bilgisi
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  role user_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated_at on profiles;

create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- businesses: işletme kayıtları, admin onayı gerektirir
create table if not exists businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  name text not null,
  slug text not null unique,
  description text,
  category business_category not null,
  city text not null default 'Bodrum',
  district text,
  address text,
  phone text,
  instagram text,
  logo_url text,
  cover_url text,
  lat double precision,
  lng double precision,
  approval_status approval_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_businesses_owner_id on businesses (owner_id);
create index if not exists idx_businesses_approval_status on businesses (approval_status);
create index if not exists idx_businesses_city_category on businesses (city, category);

drop trigger if exists trg_businesses_updated_at on businesses;

create trigger trg_businesses_updated_at
  before update on businesses
  for each row execute function set_updated_at();

-- RLS politikalarında tekrar tekrar kullanılacak, recursion'ı önleyen
-- security definer yardımcı fonksiyonlar. profiles ve businesses
-- tabloları oluşturulduktan sonra tanımlanır (LANGUAGE SQL fonksiyonlar
-- oluşturulduğu anda referans verdikleri tabloların var olmasını gerektirir).

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.owns_business(p_business_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from businesses
    where id = p_business_id and owner_id = auth.uid()
  );
$$;

-- Sahibi işletme onay durumunu doğrudan değiştiremesin; sadece admin
-- (service role / admin panelinden is_admin() doğrulamasıyla) değiştirebilir.
create or replace function public.guard_business_approval_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.approval_status is distinct from old.approval_status and not is_admin() then
    new.approval_status = old.approval_status;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_businesses_guard_approval on businesses;

create trigger trg_businesses_guard_approval
  before update on businesses
  for each row execute function guard_business_approval_status();

-- packages: işletmeye bağlı ön ödemeli paketler
create table if not exists packages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  title text not null,
  description text,
  sale_price numeric(10, 2) not null check (sale_price >= 0),
  summer_reference_price numeric(10, 2) not null check (summer_reference_price >= 0),
  normal_value numeric(10, 2) check (normal_value >= 0),
  usage_count int not null check (usage_count > 0),
  expires_at timestamptz not null,
  quota int check (quota >= 0),
  sold_count int not null default 0 check (sold_count >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_packages_business_id on packages (business_id);
create index if not exists idx_packages_is_active on packages (is_active);

drop trigger if exists trg_packages_updated_at on packages;

create trigger trg_packages_updated_at
  before update on packages
  for each row execute function set_updated_at();

-- purchases: kullanıcının paket satın alımları
create table if not exists purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  package_id uuid not null references packages (id),
  amount numeric(10, 2) not null check (amount >= 0),
  commission_amount numeric(10, 2) not null default 0 check (commission_amount >= 0),
  iyzico_payment_id text,
  status purchase_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_purchases_user_id on purchases (user_id);
create index if not exists idx_purchases_package_id on purchases (package_id);

drop trigger if exists trg_purchases_updated_at on purchases;

create trigger trg_purchases_updated_at
  before update on purchases
  for each row execute function set_updated_at();

-- entitlements: satın alımdan doğan kullanım hakları + benzersiz QR
create table if not exists entitlements (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references purchases (id) on delete cascade,
  remaining_uses int not null check (remaining_uses >= 0),
  qr_code text not null unique,
  status entitlement_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_entitlements_purchase_id on entitlements (purchase_id);
create index if not exists idx_entitlements_qr_code on entitlements (qr_code);

drop trigger if exists trg_entitlements_updated_at on entitlements;

create trigger trg_entitlements_updated_at
  before update on entitlements
  for each row execute function set_updated_at();

-- redemptions: her QR okutma kaydı
create table if not exists redemptions (
  id uuid primary key default gen_random_uuid(),
  entitlement_id uuid not null references entitlements (id),
  business_id uuid not null references businesses (id),
  redeemed_at timestamptz not null default now(),
  verified_by uuid not null references profiles (id)
);

create index if not exists idx_redemptions_entitlement_id on redemptions (entitlement_id);
create index if not exists idx_redemptions_business_id on redemptions (business_id);

-- flash_deals: Bu Akşam fırsatları
create table if not exists flash_deals (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  offer_text text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  total_quota int not null check (total_quota >= 0),
  remaining_quota int not null check (remaining_quota >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists idx_flash_deals_business_id on flash_deals (business_id);
create index if not exists idx_flash_deals_active_window on flash_deals (is_active, starts_at, ends_at);

-- events: etkinlikler
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  title text not null,
  description text,
  event_at timestamptz not null,
  image_url text,
  is_paid boolean not null default false,
  ticket_price numeric(10, 2) check (ticket_price >= 0),
  capacity int check (capacity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_events_business_id on events (business_id);
create index if not exists idx_events_event_at on events (event_at);

drop trigger if exists trg_events_updated_at on events;

create trigger trg_events_updated_at
  before update on events
  for each row execute function set_updated_at();

-- tickets: etkinlik kayıtları/biletleri
create table if not exists tickets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  status ticket_status not null default 'active',
  price_paid numeric(10, 2) check (price_paid >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_tickets_event_id on tickets (event_id);
create index if not exists idx_tickets_user_id on tickets (user_id);

-- Etkinlik kontenjanını aşan bilet kaydını engelle
create or replace function public.guard_ticket_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capacity int;
  v_active_count int;
begin
  select capacity into v_capacity from events where id = new.event_id;

  if v_capacity is not null then
    select count(*) into v_active_count
    from tickets
    where event_id = new.event_id and status = 'active';

    if v_active_count >= v_capacity then
      raise exception 'EVENT_FULL: Etkinlik kontenjanı dolu';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_tickets_guard_capacity on tickets;

create trigger trg_tickets_guard_capacity
  before insert on tickets
  for each row execute function guard_ticket_capacity();

-- announcements: işletmenin duyuru gönderimleri
create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  channel text not null,
  content text not null,
  recipient_count int not null default 0 check (recipient_count >= 0),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_announcements_business_id on announcements (business_id);

-- customers: mini-CRM, telefonla tekilleştirilmiş müşteri kaydı
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  phone text not null,
  full_name text,
  first_visit_at timestamptz,
  last_visit_at timestamptz,
  visit_count int not null default 0 check (visit_count >= 0),
  created_at timestamptz not null default now(),
  unique (business_id, phone)
);

create index if not exists idx_customers_business_id on customers (business_id);

-- =========================================================
-- SATIN ALMA TAMAMLANINCA OTOMATİK ENTITLEMENT + QR ÜRETİMİ
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
  if new.status = 'completed'
     and (tg_op = 'INSERT' or old.status is distinct from 'completed') then

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

drop trigger if exists trg_purchases_create_entitlement on purchases;

create trigger trg_purchases_create_entitlement
  after insert or update on purchases
  for each row execute function create_entitlement_on_purchase_completed();

-- =========================================================
-- GÜVENLİ QR DOĞRULAMA FONKSİYONU
-- =========================================================

create or replace function public.redeem_entitlement(p_qr_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entitlement entitlements%rowtype;
  v_package packages%rowtype;
  v_business_id uuid;
  v_redemption redemptions%rowtype;
begin
  select e.* into v_entitlement
  from entitlements e
  where e.qr_code = p_qr_code
  for update;

  if not found then
    raise exception 'QR_NOT_FOUND: QR kodu bulunamadı';
  end if;

  select p.* into v_package
  from packages p
  join purchases pu on pu.package_id = p.id
  where pu.id = v_entitlement.purchase_id;

  select b.id into v_business_id
  from businesses b
  where b.id = v_package.business_id
    and b.owner_id = auth.uid();

  if v_business_id is null then
    raise exception 'WRONG_BUSINESS: Bu QR kodu sizin işletmenize ait değil';
  end if;

  if v_entitlement.status <> 'active' or v_entitlement.remaining_uses <= 0 then
    raise exception 'NO_USES_LEFT: Bu QR kodunda kullanılabilir hak kalmamış';
  end if;

  if v_package.expires_at < now() then
    update entitlements set status = 'expired' where id = v_entitlement.id;
    raise exception 'EXPIRED: Paketin süresi dolmuş';
  end if;

  update entitlements
  set remaining_uses = remaining_uses - 1,
      status = (case when remaining_uses - 1 <= 0 then 'used' else 'active' end)::entitlement_status
  where id = v_entitlement.id;

  insert into redemptions (entitlement_id, business_id, verified_by)
  values (v_entitlement.id, v_business_id, auth.uid())
  returning * into v_redemption;

  return jsonb_build_object(
    'redemption_id', v_redemption.id,
    'entitlement_id', v_entitlement.id,
    'remaining_uses', greatest(v_entitlement.remaining_uses - 1, 0),
    'redeemed_at', v_redemption.redeemed_at
  );
end;
$$;

revoke all on function public.redeem_entitlement(text) from public;
grant execute on function public.redeem_entitlement(text) to authenticated;

-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================

alter table profiles enable row level security;
alter table businesses enable row level security;
alter table packages enable row level security;
alter table purchases enable row level security;
alter table entitlements enable row level security;
alter table redemptions enable row level security;
alter table flash_deals enable row level security;
alter table events enable row level security;
alter table tickets enable row level security;
alter table announcements enable row level security;
alter table customers enable row level security;

-- profiles ---------------------------------------------------------------

drop policy if exists "profiles_select_own_or_admin" on profiles;

create policy "profiles_select_own_or_admin"
  on profiles for select
  using (id = auth.uid() or is_admin());

drop policy if exists "profiles_insert_own" on profiles;

create policy "profiles_insert_own"
  on profiles for insert
  with check (id = auth.uid());

drop policy if exists "profiles_update_own_or_admin" on profiles;

create policy "profiles_update_own_or_admin"
  on profiles for update
  using (id = auth.uid() or is_admin());

-- businesses ---------------------------------------------------------------

drop policy if exists "businesses_select_approved_public" on businesses;

create policy "businesses_select_approved_public"
  on businesses for select
  using (approval_status = 'approved' or owner_id = auth.uid() or is_admin());

drop policy if exists "businesses_insert_own" on businesses;

create policy "businesses_insert_own"
  on businesses for insert
  with check (owner_id = auth.uid());

drop policy if exists "businesses_update_own_or_admin" on businesses;

create policy "businesses_update_own_or_admin"
  on businesses for update
  using (owner_id = auth.uid() or is_admin());

drop policy if exists "businesses_delete_own_or_admin" on businesses;

create policy "businesses_delete_own_or_admin"
  on businesses for delete
  using (owner_id = auth.uid() or is_admin());

-- packages ---------------------------------------------------------------

drop policy if exists "packages_select_public_active_or_owner" on packages;

create policy "packages_select_public_active_or_owner"
  on packages for select
  using (
    (is_active and exists (
      select 1 from businesses b
      where b.id = packages.business_id and b.approval_status = 'approved'
    ))
    or owns_business(business_id)
    or is_admin()
  );

drop policy if exists "packages_insert_owner" on packages;

create policy "packages_insert_owner"
  on packages for insert
  with check (owns_business(business_id));

drop policy if exists "packages_update_owner_or_admin" on packages;

create policy "packages_update_owner_or_admin"
  on packages for update
  using (owns_business(business_id) or is_admin());

drop policy if exists "packages_delete_owner_or_admin" on packages;

create policy "packages_delete_owner_or_admin"
  on packages for delete
  using (owns_business(business_id) or is_admin());

-- purchases ---------------------------------------------------------------

drop policy if exists "purchases_select_own_or_business_or_admin" on purchases;

create policy "purchases_select_own_or_business_or_admin"
  on purchases for select
  using (
    user_id = auth.uid()
    or is_admin()
    or exists (
      select 1 from packages p
      where p.id = purchases.package_id and owns_business(p.business_id)
    )
  );

drop policy if exists "purchases_insert_own" on purchases;

create policy "purchases_insert_own"
  on purchases for insert
  with check (user_id = auth.uid());

-- entitlements ---------------------------------------------------------------

drop policy if exists "entitlements_select_own_or_business_or_admin" on entitlements;

create policy "entitlements_select_own_or_business_or_admin"
  on entitlements for select
  using (
    is_admin()
    or exists (
      select 1 from purchases pu
      where pu.id = entitlements.purchase_id and pu.user_id = auth.uid()
    )
    or exists (
      select 1 from purchases pu
      join packages p on p.id = pu.package_id
      where pu.id = entitlements.purchase_id and owns_business(p.business_id)
    )
  );

-- entitlements üzerinde doğrudan insert/update client'a açık değil;
-- yalnızca create_entitlement_on_purchase_completed() ve
-- redeem_entitlement() (security definer) tarafından değiştirilir.

-- redemptions ---------------------------------------------------------------

drop policy if exists "redemptions_select_business_or_user_or_admin" on redemptions;

create policy "redemptions_select_business_or_user_or_admin"
  on redemptions for select
  using (
    is_admin()
    or owns_business(business_id)
    or exists (
      select 1 from entitlements e
      join purchases pu on pu.id = e.purchase_id
      where e.id = redemptions.entitlement_id and pu.user_id = auth.uid()
    )
  );

-- redemptions üzerinde doğrudan insert client'a açık değil; yalnızca
-- redeem_entitlement() (security definer) tarafından oluşturulur.

-- flash_deals ---------------------------------------------------------------

drop policy if exists "flash_deals_select_public_active_or_owner" on flash_deals;

create policy "flash_deals_select_public_active_or_owner"
  on flash_deals for select
  using (
    (is_active and exists (
      select 1 from businesses b
      where b.id = flash_deals.business_id and b.approval_status = 'approved'
    ))
    or owns_business(business_id)
    or is_admin()
  );

drop policy if exists "flash_deals_insert_owner" on flash_deals;

create policy "flash_deals_insert_owner"
  on flash_deals for insert
  with check (owns_business(business_id));

drop policy if exists "flash_deals_update_owner_or_admin" on flash_deals;

create policy "flash_deals_update_owner_or_admin"
  on flash_deals for update
  using (owns_business(business_id) or is_admin());

drop policy if exists "flash_deals_delete_owner_or_admin" on flash_deals;

create policy "flash_deals_delete_owner_or_admin"
  on flash_deals for delete
  using (owns_business(business_id) or is_admin());

-- events ---------------------------------------------------------------

drop policy if exists "events_select_public_upcoming_or_owner" on events;

create policy "events_select_public_upcoming_or_owner"
  on events for select
  using (
    (event_at >= now() and exists (
      select 1 from businesses b
      where b.id = events.business_id and b.approval_status = 'approved'
    ))
    or owns_business(business_id)
    or is_admin()
  );

drop policy if exists "events_insert_owner" on events;

create policy "events_insert_owner"
  on events for insert
  with check (owns_business(business_id));

drop policy if exists "events_update_owner_or_admin" on events;

create policy "events_update_owner_or_admin"
  on events for update
  using (owns_business(business_id) or is_admin());

drop policy if exists "events_delete_owner_or_admin" on events;

create policy "events_delete_owner_or_admin"
  on events for delete
  using (owns_business(business_id) or is_admin());

-- tickets ---------------------------------------------------------------

drop policy if exists "tickets_select_own_or_business_or_admin" on tickets;

create policy "tickets_select_own_or_business_or_admin"
  on tickets for select
  using (
    user_id = auth.uid()
    or is_admin()
    or exists (
      select 1 from events ev
      where ev.id = tickets.event_id and owns_business(ev.business_id)
    )
  );

drop policy if exists "tickets_insert_own" on tickets;

create policy "tickets_insert_own"
  on tickets for insert
  with check (user_id = auth.uid());

drop policy if exists "tickets_update_own_or_business_or_admin" on tickets;

create policy "tickets_update_own_or_business_or_admin"
  on tickets for update
  using (
    user_id = auth.uid()
    or is_admin()
    or exists (
      select 1 from events ev
      where ev.id = tickets.event_id and owns_business(ev.business_id)
    )
  );

-- announcements ---------------------------------------------------------------

drop policy if exists "announcements_select_owner_or_admin" on announcements;

create policy "announcements_select_owner_or_admin"
  on announcements for select
  using (owns_business(business_id) or is_admin());

drop policy if exists "announcements_insert_owner" on announcements;

create policy "announcements_insert_owner"
  on announcements for insert
  with check (owns_business(business_id));

drop policy if exists "announcements_update_owner_or_admin" on announcements;

create policy "announcements_update_owner_or_admin"
  on announcements for update
  using (owns_business(business_id) or is_admin());

drop policy if exists "announcements_delete_owner_or_admin" on announcements;

create policy "announcements_delete_owner_or_admin"
  on announcements for delete
  using (owns_business(business_id) or is_admin());

-- customers ---------------------------------------------------------------

drop policy if exists "customers_select_owner_or_admin" on customers;

create policy "customers_select_owner_or_admin"
  on customers for select
  using (owns_business(business_id) or is_admin());

drop policy if exists "customers_insert_owner" on customers;

create policy "customers_insert_owner"
  on customers for insert
  with check (owns_business(business_id));

drop policy if exists "customers_update_owner_or_admin" on customers;

create policy "customers_update_owner_or_admin"
  on customers for update
  using (owns_business(business_id) or is_admin());

drop policy if exists "customers_delete_owner_or_admin" on customers;

create policy "customers_delete_owner_or_admin"
  on customers for delete
  using (owns_business(business_id) or is_admin());

-- ==== supabase/migrations/20260711003340_init_schema.sql SONU ====


-- ============================================================================
-- KAYNAK DOSYA: supabase/migrations/20260711010000_storage_business_images.sql
-- ============================================================================

-- İşletme logo/kapak görselleri için Storage bucket ve erişim kuralları.
-- Dosya yolu biçimi: business-images/{owner_id}/{dosya}

insert into storage.buckets (id, name, public)
values ('business-images', 'business-images', true)
on conflict (id) do nothing;

drop policy if exists "business_images_public_read" on storage.objects;

create policy "business_images_public_read"
  on storage.objects for select
  using (bucket_id = 'business-images');

drop policy if exists "business_images_owner_insert" on storage.objects;

create policy "business_images_owner_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'business-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "business_images_owner_update" on storage.objects;

create policy "business_images_owner_update"
  on storage.objects for update
  using (
    bucket_id = 'business-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "business_images_owner_delete" on storage.objects;

create policy "business_images_owner_delete"
  on storage.objects for delete
  using (
    bucket_id = 'business-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ==== supabase/migrations/20260711010000_storage_business_images.sql SONU ====


-- ============================================================================
-- KAYNAK DOSYA: supabase/migrations/20260711020000_founder_waitlist.sql
-- ============================================================================

-- Kurucu 500 bekleme listesi (landing page e-posta toplama)

create table if not exists founder_waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_founder_waitlist_email_lower on founder_waitlist (lower(email));

alter table founder_waitlist enable row level security;

drop policy if exists "founder_waitlist_insert_public" on founder_waitlist;

create policy "founder_waitlist_insert_public"
  on founder_waitlist for insert
  to anon, authenticated
  with check (true);

drop policy if exists "founder_waitlist_select_admin" on founder_waitlist;

create policy "founder_waitlist_select_admin"
  on founder_waitlist for select
  using (is_admin());

-- ==== supabase/migrations/20260711020000_founder_waitlist.sql SONU ====


-- ============================================================================
-- KAYNAK DOSYA: supabase/migrations/20260712000000_flash_deal_reservations.sql
-- ============================================================================

-- Bu Akşam flaş fırsatları için "Yerimi Ayır" rezervasyon sistemi.

create table if not exists flash_deal_reservations (
  id uuid primary key default gen_random_uuid(),
  flash_deal_id uuid not null references flash_deals (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  confirmation_code text not null unique,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique (flash_deal_id, user_id)
);

create index if not exists idx_flash_deal_reservations_flash_deal_id on flash_deal_reservations (flash_deal_id);
create index if not exists idx_flash_deal_reservations_user_id on flash_deal_reservations (user_id);

alter table flash_deal_reservations enable row level security;

drop policy if exists "flash_deal_reservations_select_own_or_business_or_admin" on flash_deal_reservations;

create policy "flash_deal_reservations_select_own_or_business_or_admin"
  on flash_deal_reservations for select
  using (
    user_id = auth.uid()
    or is_admin()
    or exists (
      select 1 from flash_deals fd
      where fd.id = flash_deal_reservations.flash_deal_id and owns_business(fd.business_id)
    )
  );

-- Doğrudan insert client'a açık değil; yalnızca reserve_flash_deal()
-- (security definer) üzerinden oluşturulur.

-- =========================================================
-- GÜVENLİ REZERVASYON FONKSİYONU
-- =========================================================

create or replace function public.reserve_flash_deal(p_flash_deal_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deal flash_deals%rowtype;
  v_code text;
  v_reservation flash_deal_reservations%rowtype;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED: Bu işlem için giriş yapmalısın';
  end if;

  select * into v_deal
  from flash_deals
  where id = p_flash_deal_id
  for update;

  if not found then
    raise exception 'DEAL_NOT_FOUND: Flaş fırsat bulunamadı';
  end if;

  if not v_deal.is_active or now() < v_deal.starts_at or now() > v_deal.ends_at then
    raise exception 'DEAL_NOT_LIVE: Bu flaş fırsat artık geçerli değil';
  end if;

  if exists (
    select 1 from flash_deal_reservations
    where flash_deal_id = p_flash_deal_id and user_id = auth.uid()
  ) then
    raise exception 'ALREADY_RESERVED: Bu flaş için zaten yerin var';
  end if;

  if v_deal.remaining_quota <= 0 then
    raise exception 'DEAL_FULL: Kontenjan doldu';
  end if;

  update flash_deals
  set remaining_quota = remaining_quota - 1
  where id = p_flash_deal_id;

  loop
    v_code := 'FLA' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 5));
    exit when not exists (select 1 from flash_deal_reservations where confirmation_code = v_code);
  end loop;

  insert into flash_deal_reservations (flash_deal_id, user_id, confirmation_code)
  values (p_flash_deal_id, auth.uid(), v_code)
  returning * into v_reservation;

  return jsonb_build_object(
    'reservation_id', v_reservation.id,
    'confirmation_code', v_reservation.confirmation_code,
    'remaining_quota', greatest(v_deal.remaining_quota - 1, 0)
  );
end;
$$;

revoke all on function public.reserve_flash_deal(uuid) from public;
grant execute on function public.reserve_flash_deal(uuid) to authenticated;

-- ==== supabase/migrations/20260712000000_flash_deal_reservations.sql SONU ====


-- ============================================================================
-- KAYNAK DOSYA: supabase/migrations/20260713000000_ticket_qr_and_capacity_lock.sql
-- ============================================================================

-- Biletlere benzersiz QR kodu ekler ve kontenjan kontrolünü
-- (events satırını kilitleyerek) eşzamanlılığa karşı güvenli hale getirir.

alter table tickets add column if not exists qr_code text unique;

-- Bir kullanıcının aynı etkinliğe birden fazla aktif bilet/kayıt açmasını
-- (ör. çift tıklama) engeller.
create unique index if not exists idx_tickets_event_user_active
  on tickets (event_id, user_id)
  where status = 'active';

create or replace function public.guard_ticket_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capacity int;
  v_active_count int;
  v_code text;
begin
  -- events satırını kilitle: aynı etkinliğe eşzamanlı gelen kayıtlar
  -- sıraya girer, kontenjan sayımı güvenilir olur.
  select capacity into v_capacity from events where id = new.event_id for update;

  if v_capacity is not null then
    select count(*) into v_active_count
    from tickets
    where event_id = new.event_id and status = 'active';

    if v_active_count >= v_capacity then
      raise exception 'EVENT_FULL: Etkinlik kontenjanı dolu';
    end if;
  end if;

  if new.qr_code is null then
    loop
      v_code := 'TKT' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
      exit when not exists (select 1 from tickets where qr_code = v_code);
    end loop;
    new.qr_code := v_code;
  end if;

  return new;
end;
$$;

-- ==== supabase/migrations/20260713000000_ticket_qr_and_capacity_lock.sql SONU ====


-- ============================================================================
-- KAYNAK DOSYA: supabase/migrations/20260714000000_package_management.sql
-- ============================================================================

-- Paket yönetimi için ek alanlar ve satılmış paketleri koruyan kurallar.

alter table packages
  add column if not exists per_person_limit int not null default 1 check (per_person_limit > 0),
  add column if not exists usage_description text;

-- Kontrast mantığının anlamı: yaz fiyatı her zaman satış fiyatından yüksek olmalı.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'packages_summer_price_gt_sale_price') then
    alter table packages add constraint packages_summer_price_gt_sale_price
      check (summer_reference_price > sale_price);
  end if;
end $$;

-- Satışı olan pakette hak sayısı düşürülemez (mevcut alıcıları mağdur etmemek için).
create or replace function public.guard_package_usage_count_decrease()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.sold_count > 0 and new.usage_count < old.usage_count then
    raise exception 'USAGE_COUNT_LOCKED: Satışı olan pakette hak sayısı düşürülemez';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_packages_guard_usage_count on packages;

create trigger trg_packages_guard_usage_count
  before update on packages
  for each row execute function guard_package_usage_count_decrease();

-- =========================================================
-- GÜVENLİ SATIN ALMA FONKSİYONU
-- =========================================================
-- Kontenjan ve kişi başı satın alma limiti kontrolünü, paket satırını
-- kilitleyerek eşzamanlılığa karşı güvenli şekilde uygular. Ödeme bu
-- fonksiyonun DIŞINDA (paymentService) tamamlanır; burası yalnızca
-- ödeme başarılı olduktan sonra çağrılan hızlı, atomik son adımdır.

create or replace function public.create_purchase(
  p_package_id uuid,
  p_amount numeric,
  p_commission_amount numeric,
  p_provider_ref text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_package packages%rowtype;
  v_existing_count int;
  v_purchase_id uuid;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED: Bu işlem için giriş yapmalısın';
  end if;

  select * into v_package from packages where id = p_package_id for update;

  if not found then
    raise exception 'PACKAGE_NOT_FOUND: Paket bulunamadı';
  end if;

  if not v_package.is_active then
    raise exception 'PACKAGE_INACTIVE: Bu paket artık satışta değil';
  end if;

  if v_package.expires_at < now() then
    raise exception 'PACKAGE_EXPIRED: Bu paketin süresi dolmuş';
  end if;

  if v_package.quota is not null and v_package.sold_count >= v_package.quota then
    raise exception 'PACKAGE_SOLD_OUT: Bu paket için kontenjan doldu';
  end if;

  select count(*) into v_existing_count
  from purchases
  where package_id = p_package_id and user_id = auth.uid() and status = 'completed';

  if v_existing_count >= v_package.per_person_limit then
    raise exception 'PERSON_LIMIT_REACHED: Bu paketi kişi başı satın alma limitine ulaştın';
  end if;

  insert into purchases (user_id, package_id, amount, commission_amount, iyzico_payment_id, status)
  values (auth.uid(), p_package_id, p_amount, p_commission_amount, p_provider_ref, 'completed')
  returning id into v_purchase_id;

  return v_purchase_id;
end;
$$;

revoke all on function public.create_purchase(uuid, numeric, numeric, text) from public;
grant execute on function public.create_purchase(uuid, numeric, numeric, text) to authenticated;

-- ==== supabase/migrations/20260714000000_package_management.sql SONU ====


-- ============================================================================
-- KAYNAK DOSYA: supabase/migrations/20260715000000_package_image.sql
-- ============================================================================

-- Paket görseli: belirtilmezse formda işletmenin kapak görseli varsayılan
-- olarak kullanılır (uygulama katmanında), burada yalnız alanı ekliyoruz.

alter table packages add column if not exists image_url text;

-- ==== supabase/migrations/20260715000000_package_image.sql SONU ====


-- ============================================================================
-- KAYNAK DOSYA: supabase/migrations/20260716000000_event_management.sql
-- ============================================================================

-- Etkinlik yönetimi: iptal durumu, bilet iade durumu ve panel için
-- güvenli katılımcı listesi fonksiyonu (profiles tablosuna doğrudan
-- erişimi olmayan işletmenin, yalnızca kendi etkinliğinin katılımcılarını
-- görmesini sağlar).

alter table events add column if not exists is_cancelled boolean not null default false;
alter table tickets add column if not exists refund_status text;

create or replace function public.get_event_participants(p_event_id uuid)
returns table (
  ticket_id uuid,
  full_name text,
  phone text,
  created_at timestamptz,
  status ticket_status,
  price_paid numeric,
  refund_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
begin
  select business_id into v_business_id from events where id = p_event_id;

  if v_business_id is null or not owns_business(v_business_id) then
    raise exception 'FORBIDDEN: Bu etkinliğe erişim yetkin yok';
  end if;

  return query
  select t.id, p.full_name, p.phone, t.created_at, t.status, t.price_paid, t.refund_status
  from tickets t
  join profiles p on p.id = t.user_id
  where t.event_id = p_event_id
  order by t.created_at desc;
end;
$$;

revoke all on function public.get_event_participants(uuid) from public;
grant execute on function public.get_event_participants(uuid) to authenticated;

-- ==== supabase/migrations/20260716000000_event_management.sql SONU ====


-- ============================================================================
-- KAYNAK DOSYA: supabase/migrations/20260717000000_verification.sql
-- ============================================================================

-- QR Doğrulama: paket hakkı / flaş ayırtması / etkinlik bileti tek
-- güvenli fonksiyondan geçer. Her deneme (başarılı/başarısız) loglanır.

alter table flash_deal_reservations add column if not exists redeemed_at timestamptz;
alter table tickets add column if not exists checked_in_at timestamptz;

create table if not exists verification_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  code text not null,
  code_type text not null,
  result text not null,
  error_code text,
  customer_name text,
  detail text,
  verified_by uuid not null references profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists idx_verification_logs_business_id on verification_logs (business_id, created_at desc);

alter table verification_logs enable row level security;

drop policy if exists "verification_logs_select_owner_or_admin" on verification_logs;

create policy "verification_logs_select_owner_or_admin"
  on verification_logs for select
  using (owns_business(business_id) or is_admin());

-- Doğrudan insert client'a açık değil; yalnızca verify_code() (security
-- definer) tarafından oluşturulur.

-- =========================================================
-- Müşteriyi (telefonla tekilleştirilmiş) dokunuş anında günceller.
-- Yalnız başarılı doğrulamalarda çağrılır.
-- =========================================================

create or replace function public._touch_customer(p_business_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full_name text;
  v_phone text;
begin
  select full_name, phone into v_full_name, v_phone from profiles where id = p_user_id;

  if v_phone is not null then
    insert into customers (business_id, phone, full_name, first_visit_at, last_visit_at, visit_count)
    values (p_business_id, v_phone, v_full_name, now(), now(), 1)
    on conflict (business_id, phone) do update
      set full_name = coalesce(customers.full_name, excluded.full_name),
          last_visit_at = now(),
          visit_count = customers.visit_count + 1;
  end if;

  return jsonb_build_object('full_name', v_full_name, 'phone', v_phone);
end;
$$;

-- =========================================================
-- Tek giriş noktası: kod önekine göre (LCL/FLA/TKT) doğru akışa yönlenir.
-- Beklenen (kullanıcı hatası) durumlar exception fırlatmaz; bunun yerine
-- jsonb sonuç döner ki log satırı her koşulda kaydedilebilsin.
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
      select pu.user_id into v_purchase_user_id from purchases pu where pu.id = v_entitlement.purchase_id;
      select full_name into v_customer_name from profiles where id = v_purchase_user_id;

      if v_package.business_id <> v_business_id then
        v_result := jsonb_build_object('success', false, 'error_code', 'WRONG_BUSINESS', 'message', 'Bu kod sizin işletmenize ait değil');
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
            'usage_count', v_package.usage_count
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

revoke all on function public.verify_code(text) from public;
grant execute on function public.verify_code(text) to authenticated;
revoke all on function public._touch_customer(uuid, uuid) from public;

-- ==== supabase/migrations/20260717000000_verification.sql SONU ====


-- ============================================================================
-- KAYNAK DOSYA: supabase/migrations/20260718000000_customer_crm.sql
-- ============================================================================

-- Mini-CRM: işletmecinin serbest not alanı ve müşteri detay ekranı için
-- ziyaret geçmişi / sahip olunan paketleri döndüren güvenli fonksiyon.
-- Telefonla eşleştirme, profiles tablosuna doğrudan erişimi olmayan
-- işletmenin yalnızca kendi müşterisinin verisini görmesini sağlar.

alter table customers add column if not exists notes text;

create or replace function public.get_customer_detail(p_customer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_phone text;
  v_timeline jsonb;
  v_packages jsonb;
begin
  select business_id, phone into v_business_id, v_phone
  from customers where id = p_customer_id;

  if v_business_id is null or not owns_business(v_business_id) then
    raise exception 'FORBIDDEN: Bu müşteriye erişim yetkin yok';
  end if;

  select coalesce(jsonb_agg(to_jsonb(t) order by t.occurred_at desc), '[]'::jsonb) into v_timeline
  from (
    select 'paket'::text as kind, p.title as label, r.redeemed_at as occurred_at
    from redemptions r
    join entitlements e on e.id = r.entitlement_id
    join purchases pu on pu.id = e.purchase_id
    join packages p on p.id = pu.package_id
    join profiles pr on pr.id = pu.user_id
    where r.business_id = v_business_id and pr.phone = v_phone

    union all

    select 'flas'::text as kind, fd.offer_text as label, fdr.redeemed_at as occurred_at
    from flash_deal_reservations fdr
    join flash_deals fd on fd.id = fdr.flash_deal_id
    join profiles pr on pr.id = fdr.user_id
    where fd.business_id = v_business_id and pr.phone = v_phone and fdr.redeemed_at is not null

    union all

    select 'etkinlik'::text as kind, ev.title as label, t.checked_in_at as occurred_at
    from tickets t
    join events ev on ev.id = t.event_id
    join profiles pr on pr.id = t.user_id
    where ev.business_id = v_business_id and pr.phone = v_phone and t.checked_in_at is not null
  ) t;

  select coalesce(jsonb_agg(jsonb_build_object(
    'package_title', p.title,
    'remaining_uses', e.remaining_uses,
    'usage_count', p.usage_count,
    'status', e.status,
    'qr_code', e.qr_code
  ) order by e.created_at desc), '[]'::jsonb) into v_packages
  from entitlements e
  join purchases pu on pu.id = e.purchase_id
  join packages p on p.id = pu.package_id
  join profiles pr on pr.id = pu.user_id
  where p.business_id = v_business_id and pr.phone = v_phone;

  return jsonb_build_object('timeline', v_timeline, 'packages', v_packages);
end;
$$;

revoke all on function public.get_customer_detail(uuid) from public;
grant execute on function public.get_customer_detail(uuid) to authenticated;

-- ==== supabase/migrations/20260718000000_customer_crm.sql SONU ====


-- ============================================================================
-- KAYNAK DOSYA: supabase/migrations/20260719000000_announcements.sql
-- ============================================================================

-- Duyuru aracı: hedef segment kaydı ve segmentteki alıcıları (telefon +
-- e-posta) güvenli biçimde döndüren fonksiyon. profiles/auth.users
-- tablolarına doğrudan erişimi olmayan işletmenin yalnızca kendi
-- müşterilerine ait iletişim bilgilerini görmesini sağlar.

alter table announcements add column if not exists target_segment text not null default 'tumu';
alter table announcements add column if not exists template_key text;

create or replace function public.get_segment_recipients(p_business_id uuid, p_segment text)
returns table (full_name text, phone text, email text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not owns_business(p_business_id) then
    raise exception 'FORBIDDEN: Bu işletmeye erişim yetkin yok';
  end if;

  return query
  select c.full_name, c.phone, u.email::text
  from customers c
  left join profiles pr on pr.phone = c.phone
  left join auth.users u on u.id = pr.id
  where c.business_id = p_business_id
    and (
      p_segment = 'tumu'
      or (p_segment = 'yeni' and c.first_visit_at is not null
          and date_trunc('month', c.first_visit_at) = date_trunc('month', now()))
      or (p_segment = 'sadik' and c.visit_count >= 3)
      or (p_segment = 'uyuyan' and c.last_visit_at is not null and c.last_visit_at < now() - interval '30 days')
    );
end;
$$;

revoke all on function public.get_segment_recipients(uuid, text) from public;
grant execute on function public.get_segment_recipients(uuid, text) to authenticated;

-- ==== supabase/migrations/20260719000000_announcements.sql SONU ====


-- ============================================================================
-- KAYNAK DOSYA: supabase/migrations/20260720000000_cron_jobs.sql
-- ============================================================================

-- Zamanlanmış işler (Vercel Cron) için loglar, bildirim kuyruğu ve
-- işletme başına günlük özet tabloları. Bu tablolara yazma işlemi
-- yalnızca service role ile (cron uç noktalarından) yapılır; RLS burada
-- yalnızca panel/admin tarafındaki okuma erişimini sınırlar.

create table if not exists cron_logs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  status text not null,
  affected_count int not null default 0,
  message text,
  run_at timestamptz not null default now()
);

create index if not exists idx_cron_logs_job_name on cron_logs (job_name, run_at desc);

alter table cron_logs enable row level security;

drop policy if exists "cron_logs_select_admin" on cron_logs;

create policy "cron_logs_select_admin"
  on cron_logs for select
  using (is_admin());

create table if not exists notification_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists idx_notification_queue_status on notification_queue (status, created_at);

-- Paket hatırlatmasının aynı hak için birden fazla kez kuyruğa girmesini
-- (job iki kez çalışsa bile) engeller.
create unique index if not exists idx_notification_queue_entitlement_reminder
  on notification_queue (((payload ->> 'entitlement_id')))
  where kind = 'package_expiry_reminder';

alter table notification_queue enable row level security;

drop policy if exists "notification_queue_select_admin" on notification_queue;

create policy "notification_queue_select_admin"
  on notification_queue for select
  using (is_admin());

create table if not exists business_daily_summaries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  summary_date date not null,
  sales_count int not null default 0,
  sales_amount numeric(10, 2) not null default 0,
  redemptions_count int not null default 0,
  flash_reservations_count int not null default 0,
  tickets_count int not null default 0,
  created_at timestamptz not null default now(),
  unique (business_id, summary_date)
);

create index if not exists idx_business_daily_summaries_business_date
  on business_daily_summaries (business_id, summary_date desc);

alter table business_daily_summaries enable row level security;

drop policy if exists "business_daily_summaries_select_owner_or_admin" on business_daily_summaries;

create policy "business_daily_summaries_select_owner_or_admin"
  on business_daily_summaries for select
  using (owns_business(business_id) or is_admin());

-- ==== supabase/migrations/20260720000000_cron_jobs.sql SONU ====


-- ============================================================================
-- KAYNAK DOSYA: supabase/migrations/20260721000000_iyzico_marketplace.sql
-- ============================================================================

-- iyzico pazaryeri entegrasyonu: alt üye işyeri kaydı, gerçek ödeme akışı
-- (checkout form + doğrulanmış geri dönüş), komisyon ayarı ve iade akışı.

-- =========================================================
-- İŞLETME: ALT ÜYE İŞYERİ BİLGİLERİ
-- =========================================================

alter table businesses add column if not exists legal_name text;
alter table businesses add column if not exists tax_identity_number text;
alter table businesses add column if not exists iban text;
alter table businesses add column if not exists iyzico_submerchant_type text;
alter table businesses add column if not exists iyzico_submerchant_key text;
alter table businesses add column if not exists iyzico_onboarding_status text not null default 'not_started';
-- iyzico_onboarding_status: not_started | pending | approved | rejected
alter table businesses add column if not exists iyzico_reject_reason text;

-- =========================================================
-- PLATFORM AYARLARI (tekil satır — yapılandırılabilir komisyon oranı)
-- =========================================================

create table if not exists platform_settings (
  id boolean primary key default true,
  commission_rate numeric(4, 3) not null default 0.09,
  updated_at timestamptz not null default now(),
  constraint platform_settings_singleton check (id)
);

insert into platform_settings (id) values (true)
on conflict (id) do nothing;

alter table platform_settings enable row level security;

drop policy if exists "platform_settings_select_all" on platform_settings;

create policy "platform_settings_select_all"
  on platform_settings for select
  using (true);

drop policy if exists "platform_settings_update_admin" on platform_settings;

create policy "platform_settings_update_admin"
  on platform_settings for update
  using (is_admin());

-- =========================================================
-- PURCHASES: gerçek ödeme akışı alanları
-- =========================================================

alter table purchases add column if not exists business_payout_amount numeric(10, 2);
alter table purchases add column if not exists provider_status text not null default 'pending';
alter table purchases add column if not exists checkout_token text unique;
alter table purchases add column if not exists checkout_form_content text;
alter table purchases add column if not exists payment_transaction_id text;
alter table purchases add column if not exists refund_requested boolean not null default false;
alter table purchases add column if not exists refund_requested_at timestamptz;
alter table purchases add column if not exists refund_reject_reason text;

create index if not exists idx_purchases_checkout_token on purchases (checkout_token);
create index if not exists idx_purchases_refund_requested on purchases (refund_requested) where refund_requested;

-- =========================================================
-- ÖDEME OLAYI LOGU (webhook/callback tekrarlarına karşı idempotency)
-- =========================================================

create table if not exists payment_events (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid references purchases (id) on delete set null,
  conversation_id text not null,
  event_type text not null,
  status text not null,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  unique (conversation_id, event_type)
);

alter table payment_events enable row level security;

drop policy if exists "payment_events_select_admin" on payment_events;

create policy "payment_events_select_admin"
  on payment_events for select
  using (is_admin());

-- =========================================================
-- İADE TALEBİ / ONAY / RED (güvenli fonksiyonlar)
-- =========================================================

create or replace function public.request_refund(p_purchase_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purchase purchases%rowtype;
  v_entitlement entitlements%rowtype;
  v_package packages%rowtype;
begin
  select * into v_purchase from purchases where id = p_purchase_id and user_id = auth.uid();

  if not found then
    raise exception 'NOT_FOUND: Satın alma bulunamadı';
  end if;

  if v_purchase.status <> 'completed' then
    raise exception 'NOT_ELIGIBLE: Bu satın alma iade edilemez';
  end if;

  if v_purchase.refund_requested then
    raise exception 'ALREADY_REQUESTED: İade talebi zaten oluşturulmuş';
  end if;

  if v_purchase.created_at < now() - interval '14 days' then
    raise exception 'WINDOW_EXPIRED: İade süresi (14 gün) doldu';
  end if;

  select * into v_entitlement from entitlements where purchase_id = v_purchase.id;
  select * into v_package from packages where id = v_purchase.package_id;

  if v_entitlement.remaining_uses is distinct from v_package.usage_count then
    raise exception 'ALREADY_USED: Bu paketin hakları kullanılmaya başlanmış, iade edilemez';
  end if;

  update purchases
  set refund_requested = true, refund_requested_at = now()
  where id = p_purchase_id;

  return jsonb_build_object('success', true);
end;
$$;

revoke all on function public.request_refund(uuid) from public;
grant execute on function public.request_refund(uuid) to authenticated;

-- Gerçek iyzico iade çağrısı Node tarafında yapılır (bkz. lib/iyzico);
-- başarılı olursa admin server action'ı bu fonksiyonu çağırıp durumu kapatır.
create or replace function public.finalize_refund(p_purchase_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'FORBIDDEN: Yalnızca admin iade onaylayabilir';
  end if;

  update purchases
  set status = 'refunded', refund_requested = false
  where id = p_purchase_id;

  update entitlements
  set status = 'expired', remaining_uses = 0
  where purchase_id = p_purchase_id;

  update packages
  set sold_count = greatest(sold_count - 1, 0)
  where id = (select package_id from purchases where id = p_purchase_id);

  return jsonb_build_object('success', true);
end;
$$;

revoke all on function public.finalize_refund(uuid) from public;
grant execute on function public.finalize_refund(uuid) to authenticated;

create or replace function public.reject_refund(p_purchase_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'FORBIDDEN: Yalnızca admin iade reddedebilir';
  end if;

  update purchases
  set refund_requested = false, refund_reject_reason = p_reason
  where id = p_purchase_id;

  return jsonb_build_object('success', true);
end;
$$;

revoke all on function public.reject_refund(uuid, text) from public;
grant execute on function public.reject_refund(uuid, text) to authenticated;

-- ==== supabase/migrations/20260721000000_iyzico_marketplace.sql SONU ====


-- ============================================================================
-- KAYNAK DOSYA: supabase/migrations/20260722000000_admin_panel.sql
-- ============================================================================

-- Admin paneli: işletme askıya alma durumu ve admin tarafından
-- kaldırılan içeriği işletmeciye ayırt ettirecek işaretler.

alter type approval_status add value if not exists 'suspended';

-- Postgres yeni eklenen bir enum değerinin aynı transaction içinde
-- kullanılmasına izin vermez; bu commit onu kalıcı hale getirip betiğin
-- geri kalanı için güvenli hale getirir (değer zaten varsa zararsızdır).
commit;

alter table businesses add column if not exists suspend_reason text;

alter table packages add column if not exists removed_by_admin boolean not null default false;
alter table flash_deals add column if not exists removed_by_admin boolean not null default false;
alter table events add column if not exists removed_by_admin boolean not null default false;

-- ==== supabase/migrations/20260722000000_admin_panel.sql SONU ====
-- ============================================================================
-- KAYNAK DOSYA: supabase/migrations/20260723000000_admin_allowlist_and_ai_assistant.sql
-- (orijinalden farkı: "if not exists" / "on conflict" / "drop policy if
--  exists" eklendi — mantık ve içerik birebir aynı)
-- ============================================================================

-- Admin e-posta beyaz listesi: bu tabloda kayıtlı bir e-posta ile kayıt
-- olan (veya zaten kayıtlı olan) kullanıcıya profiles.role otomatik
-- 'admin' atanır. Sadece sunucu tarafı (service role) erişebilir; RLS
-- açık ama hiçbir policy tanımlı değil, yani client'tan asla okunamaz/yazılamaz.
create table if not exists admin_emails (
  email text primary key,
  created_at timestamptz not null default now()
);

alter table admin_emails enable row level security;

insert into admin_emails (email) values ('m.asimdnzl13@gmail.com')
on conflict (email) do nothing;

-- AI kampanya asistanı kullanım logu: hangi işletme, ne zaman, hangi
-- amaçla (paket başlığı/metni veya duyuru mesajı) ne kadar istek attı.
create table if not exists ai_generation_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  kind text not null check (kind in ('paket', 'duyuru')),
  tone text,
  created_at timestamptz not null default now()
);

create index if not exists ai_generation_logs_business_id_idx on ai_generation_logs (business_id);

alter table ai_generation_logs enable row level security;

drop policy if exists "ai_generation_logs_select_owner_or_admin" on ai_generation_logs;
create policy "ai_generation_logs_select_owner_or_admin"
  on ai_generation_logs for select
  using (owns_business(business_id) or is_admin());

drop policy if exists "ai_generation_logs_insert_owner" on ai_generation_logs;
create policy "ai_generation_logs_insert_owner"
  on ai_generation_logs for insert
  with check (owns_business(business_id));

-- ==== supabase/migrations/20260723000000_admin_allowlist_and_ai_assistant.sql SONU ====


-- ============================================================================
-- KAYNAK DOSYA: supabase/migrations/20260724000000_pilot_mode_enum.sql
-- (orijinalden farkı: "add value if not exists" + aradaki commit +
--  "add column if not exists" eklendi — mantık ve içerik birebir aynı)
-- ============================================================================

-- PİLOT MOD: ödeme platformdan geçmez, işletmede nakit/kart alınır.
alter type purchase_status add value if not exists 'reserved';
alter type purchase_status add value if not exists 'cancelled';

-- Postgres, bir transaction içinde YENİ eklenen bir enum değerinin aynı
-- transaction içinde kullanılmasına izin vermez. Bu commit, yukarıdaki
-- değerleri kalıcı hale getirip betiğin geri kalanı (ve ileride bu
-- değerleri kullanacak her şey) için güvenli hale getirir. Değerler zaten
-- daha önce eklenmişse bu satırların hiçbir etkisi olmaz, yalnızca
-- zararsız bir commit gerçekleşir.
commit;

-- Bir rezervasyonun neden iptal/düşme olduğunu ayırt etmek için
-- (işletme elle iptal etti mi, yoksa uzun süre gelinmediği için
-- otomatik mi düştü).
alter table purchases add column if not exists cancelled_reason text;

-- ==== supabase/migrations/20260724000000_pilot_mode_enum.sql SONU ====


-- ============================================================================
-- KAYNAK DOSYA: supabase/migrations/20260724000100_pilot_mode.sql
-- (orijinalden farkı yok — tamamı "create or replace function" +
--  "revoke"/"grant" olduğu için zaten tekrar çalıştırılmaya dayanıklı)
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
-- (orijinalden farkı: "add column if not exists" / "create index if not
--  exists" eklendi — mantık ve içerik birebir aynı)
-- ============================================================================

-- Demo veri seti altyapısı: hangi kayıtların demo olduğunu işaretleyen
-- bayraklar + admin panelinden tek tıkla temizleme. Gerçek verilere asla
-- dokunmaz çünkü her şey is_demo = true filtresiyle sınırlanır.

alter table profiles add column if not exists is_demo boolean not null default false;
alter table businesses add column if not exists is_demo boolean not null default false;

create index if not exists idx_profiles_is_demo on profiles (is_demo) where is_demo;
create index if not exists idx_businesses_is_demo on businesses (is_demo) where is_demo;

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
-- (orijinalden farkı yok — dosyanın tamamı zaten "create or replace
--  function" olarak tanımlanan admin_load_demo_data() fonksiyonunun
--  GÖVDESİ; içindeki tüm insert'ler zaten "on conflict ... do nothing"
--  kullanıyor, yani fonksiyon tanımlanırken hiçbir veri satırı hemen
--  eklenmiyor — veri yalnızca admin panelden "Demo Verisini Yükle"
--  düğmesine basıldığında, ayrı bir çağrıda eklenir)
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
-- (orijinalden farkı yok — tek satır bir UPDATE, doğası gereği zaten
--  tekrar çalıştırılmaya dayanıklı: ikinci çalıştırmada 0 satır etkiler)
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
-- (orijinalden farkı yok — baştan itibaren "if not exists" / "on conflict
--  do nothing" / "create or replace function" ile yazıldığı için zaten
--  tekrar çalıştırılmaya dayanıklıydı)
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


-- ============================================================================
-- KAYNAK DOSYA: supabase/migrations/20260820000200_schema_migrations_log.sql
-- ============================================================================

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

-- ==== supabase/migrations/20260820000200_schema_migrations_log.sql SONU ====


-- =============================================================================
-- ÖZET SORGUSU — betiğin en altında, çalıştırdıktan sonra bunu görürsün.
-- 22 satır olmalı, hepsinde bir "applied_at" tarihi olmalı. Eksik bir satır
-- varsa (22'den az satır dönerse), o migration'ın imza nesnesi hâlâ
-- bulunamadı demektir — yukarıdaki ilgili "KAYNAK DOSYA" bölümünü kontrol et.
-- =============================================================================

select
  filename,
  applied_at,
  note
from public.schema_migrations_log
order by filename;
