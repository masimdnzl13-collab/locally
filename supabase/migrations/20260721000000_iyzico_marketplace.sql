-- iyzico pazaryeri entegrasyonu: alt üye işyeri kaydı, gerçek ödeme akışı
-- (checkout form + doğrulanmış geri dönüş), komisyon ayarı ve iade akışı.

-- =========================================================
-- İŞLETME: ALT ÜYE İŞYERİ BİLGİLERİ
-- =========================================================

alter table businesses add column legal_name text;
alter table businesses add column tax_identity_number text;
alter table businesses add column iban text;
alter table businesses add column iyzico_submerchant_type text;
alter table businesses add column iyzico_submerchant_key text;
alter table businesses add column iyzico_onboarding_status text not null default 'not_started';
-- iyzico_onboarding_status: not_started | pending | approved | rejected
alter table businesses add column iyzico_reject_reason text;

-- =========================================================
-- PLATFORM AYARLARI (tekil satır — yapılandırılabilir komisyon oranı)
-- =========================================================

create table platform_settings (
  id boolean primary key default true,
  commission_rate numeric(4, 3) not null default 0.09,
  updated_at timestamptz not null default now(),
  constraint platform_settings_singleton check (id)
);

insert into platform_settings (id) values (true);

alter table platform_settings enable row level security;

create policy "platform_settings_select_all"
  on platform_settings for select
  using (true);

create policy "platform_settings_update_admin"
  on platform_settings for update
  using (is_admin());

-- =========================================================
-- PURCHASES: gerçek ödeme akışı alanları
-- =========================================================

alter table purchases add column business_payout_amount numeric(10, 2);
alter table purchases add column provider_status text not null default 'pending';
alter table purchases add column checkout_token text unique;
alter table purchases add column checkout_form_content text;
alter table purchases add column payment_transaction_id text;
alter table purchases add column refund_requested boolean not null default false;
alter table purchases add column refund_requested_at timestamptz;
alter table purchases add column refund_reject_reason text;

create index idx_purchases_checkout_token on purchases (checkout_token);
create index idx_purchases_refund_requested on purchases (refund_requested) where refund_requested;

-- =========================================================
-- ÖDEME OLAYI LOGU (webhook/callback tekrarlarına karşı idempotency)
-- =========================================================

create table payment_events (
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
