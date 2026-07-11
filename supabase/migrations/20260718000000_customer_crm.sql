-- Mini-CRM: işletmecinin serbest not alanı ve müşteri detay ekranı için
-- ziyaret geçmişi / sahip olunan paketleri döndüren güvenli fonksiyon.
-- Telefonla eşleştirme, profiles tablosuna doğrudan erişimi olmayan
-- işletmenin yalnızca kendi müşterisinin verisini görmesini sağlar.

alter table customers add column notes text;

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
