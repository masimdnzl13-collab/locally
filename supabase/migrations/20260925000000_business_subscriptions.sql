-- =============================================================================
-- P4 — ÖDEME KATMANI (ABD PAZARI): İŞLETME ABONELİKLERİ
--
-- ABD pazarındaki (businesses.market = 'US') işletmeler Stripe üzerinden
-- abone olur. Satırlar YALNIZCA sunucu tarafında, servis rolüyle yazılır:
-- abonelik Stripe Checkout'ta tamamlanınca webhook (app/api/webhooks/stripe)
-- satırı oluşturur, fatura/iptal olayları durumunu günceller. Client'ın
-- insert/update/delete policy'si bilerek yok — işletme sahibi kendi
-- aboneliğini "aktif" yapamasın.
--
-- Webhook tekrarları: her Stripe olayı payment_events'e (conversation_id =
-- Stripe event id) yazılır; mevcut unique (conversation_id, event_type)
-- indeksi aynı olayın iki kez işlenmesini engeller.
-- =============================================================================

create table if not exists business_subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  provider text not null check (provider in ('stripe', 'iyzico')),
  provider_customer_id text,
  provider_subscription_id text not null unique,
  status text not null default 'active'
    check (status in ('active', 'past_due', 'canceled')),
  current_period_end timestamptz,
  last_payment_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_business_subscriptions_business_id
  on business_subscriptions (business_id);

alter table business_subscriptions enable row level security;

drop policy if exists "business_subscriptions_select_own_or_admin" on business_subscriptions;
create policy "business_subscriptions_select_own_or_admin"
  on business_subscriptions for select
  using (
    is_admin()
    or exists (
      select 1 from businesses b
      where b.id = business_subscriptions.business_id and b.owner_id = auth.uid()
    )
  );

insert into public.schema_migrations_log (filename, note)
values ('20260925000000_business_subscriptions.sql', 'bu çalıştırmada uygulandı')
on conflict (filename) do nothing;
