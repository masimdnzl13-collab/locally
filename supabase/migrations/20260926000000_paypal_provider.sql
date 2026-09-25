-- =============================================================================
-- AI / AJ — ABD PAZARI ÖDEME SAĞLAYICISI: STRIPE → PAYPAL
--
-- İşletme abonelikleri PayPal Subscriptions, etkinlik biletleri PayPal Orders
-- v2 ile alınır (bkz. lib/payments/paypal-provider.ts). Stripe kodu referans
-- olarak duruyor; mevcut 'stripe' satırları geçerli kalır.
--
-- PayPal'da tek seferlik ödemenin "30 dk içinde ödenmezse düş" süresi
-- sağlayıcıda değil bizde tutulur (Stripe Checkout'un expires_at'i yok):
-- tickets.payment_expires_at. Süresi dolmuş bekleyen bilet için ödeme tahsil
-- EDİLMEZ, bilet 'expired' olur ve kontenjan boşalır.
-- =============================================================================

alter table business_subscriptions drop constraint if exists business_subscriptions_provider_check;
alter table business_subscriptions add constraint business_subscriptions_provider_check
  check (provider in ('paypal', 'stripe', 'iyzico'));

alter table us_onboarding drop constraint if exists us_onboarding_payment_mode_check;
alter table us_onboarding add constraint us_onboarding_payment_mode_check
  check (payment_mode in ('paypal', 'stripe', 'test'));

alter table tickets add column if not exists payment_expires_at timestamptz;

create index if not exists idx_tickets_pending_payment_expiry
  on tickets (payment_expires_at)
  where payment_status = 'pending';

-- guard_ticket_payment (20260925000500) istemcinin ödeme alanlarını sıfırlar;
-- yeni kolon da istemciden yazılamasın.
create or replace function public.guard_ticket_payment_expiry()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') and not is_admin() then
    if tg_op = 'INSERT' then
      new.payment_expires_at := null;
    else
      new.payment_expires_at := old.payment_expires_at;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tickets_payment_expiry_guard on tickets;
create trigger trg_tickets_payment_expiry_guard
  before insert or update on tickets
  for each row execute function guard_ticket_payment_expiry();

insert into public.schema_migrations_log (filename, note)
values ('20260926000000_paypal_provider.sql', 'bu çalıştırmada uygulandı')
on conflict (filename) do nothing;
