-- Locally — başlangıç şeması ve güvenlik kuralları
-- Tablolar: profiles, businesses, packages, purchases, entitlements,
-- redemptions, flash_deals, events, tickets, announcements, customers

-- =========================================================
-- ENUM TİPLERİ
-- =========================================================

create type user_role as enum ('user', 'business', 'admin');

create type business_category as enum (
  'restoran', 'kafe', 'otel', 'beach_club', 'aktivite', 'diger'
);

create type approval_status as enum ('pending', 'approved', 'rejected');

create type purchase_status as enum ('pending', 'completed', 'failed', 'refunded');

create type entitlement_status as enum ('active', 'used', 'expired');

create type ticket_status as enum ('active', 'cancelled', 'used');

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
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  role user_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- businesses: işletme kayıtları, admin onayı gerektirir
create table businesses (
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

create index idx_businesses_owner_id on businesses (owner_id);
create index idx_businesses_approval_status on businesses (approval_status);
create index idx_businesses_city_category on businesses (city, category);

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

create trigger trg_businesses_guard_approval
  before update on businesses
  for each row execute function guard_business_approval_status();

-- packages: işletmeye bağlı ön ödemeli paketler
create table packages (
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

create index idx_packages_business_id on packages (business_id);
create index idx_packages_is_active on packages (is_active);

create trigger trg_packages_updated_at
  before update on packages
  for each row execute function set_updated_at();

-- purchases: kullanıcının paket satın alımları
create table purchases (
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

create index idx_purchases_user_id on purchases (user_id);
create index idx_purchases_package_id on purchases (package_id);

create trigger trg_purchases_updated_at
  before update on purchases
  for each row execute function set_updated_at();

-- entitlements: satın alımdan doğan kullanım hakları + benzersiz QR
create table entitlements (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references purchases (id) on delete cascade,
  remaining_uses int not null check (remaining_uses >= 0),
  qr_code text not null unique,
  status entitlement_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_entitlements_purchase_id on entitlements (purchase_id);
create index idx_entitlements_qr_code on entitlements (qr_code);

create trigger trg_entitlements_updated_at
  before update on entitlements
  for each row execute function set_updated_at();

-- redemptions: her QR okutma kaydı
create table redemptions (
  id uuid primary key default gen_random_uuid(),
  entitlement_id uuid not null references entitlements (id),
  business_id uuid not null references businesses (id),
  redeemed_at timestamptz not null default now(),
  verified_by uuid not null references profiles (id)
);

create index idx_redemptions_entitlement_id on redemptions (entitlement_id);
create index idx_redemptions_business_id on redemptions (business_id);

-- flash_deals: Bu Akşam fırsatları
create table flash_deals (
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

create index idx_flash_deals_business_id on flash_deals (business_id);
create index idx_flash_deals_active_window on flash_deals (is_active, starts_at, ends_at);

-- events: etkinlikler
create table events (
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

create index idx_events_business_id on events (business_id);
create index idx_events_event_at on events (event_at);

create trigger trg_events_updated_at
  before update on events
  for each row execute function set_updated_at();

-- tickets: etkinlik kayıtları/biletleri
create table tickets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  status ticket_status not null default 'active',
  price_paid numeric(10, 2) check (price_paid >= 0),
  created_at timestamptz not null default now()
);

create index idx_tickets_event_id on tickets (event_id);
create index idx_tickets_user_id on tickets (user_id);

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

create trigger trg_tickets_guard_capacity
  before insert on tickets
  for each row execute function guard_ticket_capacity();

-- announcements: işletmenin duyuru gönderimleri
create table announcements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  channel text not null,
  content text not null,
  recipient_count int not null default 0 check (recipient_count >= 0),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_announcements_business_id on announcements (business_id);

-- customers: mini-CRM, telefonla tekilleştirilmiş müşteri kaydı
create table customers (
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

create index idx_customers_business_id on customers (business_id);

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

create policy "profiles_select_own_or_admin"
  on profiles for select
  using (id = auth.uid() or is_admin());

create policy "profiles_insert_own"
  on profiles for insert
  with check (id = auth.uid());

create policy "profiles_update_own_or_admin"
  on profiles for update
  using (id = auth.uid() or is_admin());

-- businesses ---------------------------------------------------------------

create policy "businesses_select_approved_public"
  on businesses for select
  using (approval_status = 'approved' or owner_id = auth.uid() or is_admin());

create policy "businesses_insert_own"
  on businesses for insert
  with check (owner_id = auth.uid());

create policy "businesses_update_own_or_admin"
  on businesses for update
  using (owner_id = auth.uid() or is_admin());

create policy "businesses_delete_own_or_admin"
  on businesses for delete
  using (owner_id = auth.uid() or is_admin());

-- packages ---------------------------------------------------------------

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

create policy "packages_insert_owner"
  on packages for insert
  with check (owns_business(business_id));

create policy "packages_update_owner_or_admin"
  on packages for update
  using (owns_business(business_id) or is_admin());

create policy "packages_delete_owner_or_admin"
  on packages for delete
  using (owns_business(business_id) or is_admin());

-- purchases ---------------------------------------------------------------

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

create policy "purchases_insert_own"
  on purchases for insert
  with check (user_id = auth.uid());

-- entitlements ---------------------------------------------------------------

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

create policy "flash_deals_insert_owner"
  on flash_deals for insert
  with check (owns_business(business_id));

create policy "flash_deals_update_owner_or_admin"
  on flash_deals for update
  using (owns_business(business_id) or is_admin());

create policy "flash_deals_delete_owner_or_admin"
  on flash_deals for delete
  using (owns_business(business_id) or is_admin());

-- events ---------------------------------------------------------------

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

create policy "events_insert_owner"
  on events for insert
  with check (owns_business(business_id));

create policy "events_update_owner_or_admin"
  on events for update
  using (owns_business(business_id) or is_admin());

create policy "events_delete_owner_or_admin"
  on events for delete
  using (owns_business(business_id) or is_admin());

-- tickets ---------------------------------------------------------------

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

create policy "tickets_insert_own"
  on tickets for insert
  with check (user_id = auth.uid());

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

create policy "announcements_select_owner_or_admin"
  on announcements for select
  using (owns_business(business_id) or is_admin());

create policy "announcements_insert_owner"
  on announcements for insert
  with check (owns_business(business_id));

create policy "announcements_update_owner_or_admin"
  on announcements for update
  using (owns_business(business_id) or is_admin());

create policy "announcements_delete_owner_or_admin"
  on announcements for delete
  using (owns_business(business_id) or is_admin());

-- customers ---------------------------------------------------------------

create policy "customers_select_owner_or_admin"
  on customers for select
  using (owns_business(business_id) or is_admin());

create policy "customers_insert_owner"
  on customers for insert
  with check (owns_business(business_id));

create policy "customers_update_owner_or_admin"
  on customers for update
  using (owns_business(business_id) or is_admin());

create policy "customers_delete_owner_or_admin"
  on customers for delete
  using (owns_business(business_id) or is_admin());
