-- Bu Akşam flaş fırsatları için "Yerimi Ayır" rezervasyon sistemi.

create table flash_deal_reservations (
  id uuid primary key default gen_random_uuid(),
  flash_deal_id uuid not null references flash_deals (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  confirmation_code text not null unique,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique (flash_deal_id, user_id)
);

create index idx_flash_deal_reservations_flash_deal_id on flash_deal_reservations (flash_deal_id);
create index idx_flash_deal_reservations_user_id on flash_deal_reservations (user_id);

alter table flash_deal_reservations enable row level security;

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
