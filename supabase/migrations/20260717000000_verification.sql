-- QR Doğrulama: paket hakkı / flaş ayırtması / etkinlik bileti tek
-- güvenli fonksiyondan geçer. Her deneme (başarılı/başarısız) loglanır.

alter table flash_deal_reservations add column redeemed_at timestamptz;
alter table tickets add column checked_in_at timestamptz;

create table verification_logs (
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

create index idx_verification_logs_business_id on verification_logs (business_id, created_at desc);

alter table verification_logs enable row level security;

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
