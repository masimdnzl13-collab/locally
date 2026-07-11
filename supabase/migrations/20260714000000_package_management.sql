-- Paket yönetimi için ek alanlar ve satılmış paketleri koruyan kurallar.

alter table packages
  add column per_person_limit int not null default 1 check (per_person_limit > 0),
  add column usage_description text;

-- Kontrast mantığının anlamı: yaz fiyatı her zaman satış fiyatından yüksek olmalı.
alter table packages
  add constraint packages_summer_price_gt_sale_price
  check (summer_reference_price > sale_price);

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
