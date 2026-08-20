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
