-- =============================================================================
-- AI/AJ — ABD PAZARI ÖDEME SAĞLAYICISI: PAYPAL
--
-- ABD aboneliği ve etkinlik bileti ödemeleri Stripe'tan PayPal'a taşındı
-- (lib/payments/paypal-provider.ts). Stripe kayıtları geçerli kalır; yalnızca
-- izin verilen sağlayıcı değerlerine 'paypal' eklenir.
--   * business_subscriptions.provider: PayPal abonelik kimliği (I-...)
--   * us_onboarding.payment_mode: ödemenin hangi sağlayıcıdan geldiği
--   * tickets.payment_provider serbest metin (kısıt yok), provider_session_id
--     PayPal sipariş kimliğini tutar.
-- =============================================================================

alter table business_subscriptions drop constraint if exists business_subscriptions_provider_check;
alter table business_subscriptions
  add constraint business_subscriptions_provider_check
  check (provider in ('stripe', 'iyzico', 'paypal'));

alter table us_onboarding drop constraint if exists us_onboarding_payment_mode_check;
alter table us_onboarding
  add constraint us_onboarding_payment_mode_check
  check (payment_mode in ('stripe', 'paypal', 'test'));

insert into public.schema_migrations_log (filename, note)
values ('20260925000900_paypal_provider.sql', 'bu çalıştırmada uygulandı')
on conflict (filename) do nothing;
