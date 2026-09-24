-- =============================================================================
-- ABD ETKİNLİK BİLETİ TEK SEFERLİK ÖDEME (Stripe Checkout, mode: payment)
-- + ABONELİK "DÖNEM SONUNDA İPTAL" İŞARETİ
--
-- Akış (bkz. lib/events/ticket-payments.ts):
--   1) Sunucu (servis rolü) bileti status='active', payment_status='pending'
--      ile açar → kontenjan tutulur, ama QR kodu YOKTUR (doğrulanamaz,
--      "biletlerim"de görünmez).
--   2) Stripe checkout.session.completed → payment_status='paid'; QR kodu
--      bu trigger'da atanır.
--   3) checkout.session.expired (30 dk) → bilet 'cancelled' / 'expired',
--      kontenjan serbest kalır.
--
-- GÜVENLİK: tickets RLS'i kullanıcının kendi biletini eklemesine/
-- güncellemesine izin veriyor. Bu yüzden guard_ticket_payment:
--   * istemci (authenticated/anon, admin değil) ödeme alanlarını ASLA
--     değiştiremez — kendini "paid" yapamaz;
--   * istemci ABD pazarındaki ÜCRETLİ bir etkinliğe doğrudan bilet açamaz
--     (yalnızca ödeme akışı, servis rolüyle açar). TR pilot akışı
--     (kapıda ödeme) değişmez.
-- =============================================================================

alter table tickets add column if not exists payment_status text not null default 'not_required';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tickets_payment_status_valid') then
    alter table tickets add constraint tickets_payment_status_valid
      check (payment_status in ('not_required', 'pending', 'paid', 'failed', 'expired', 'refunded'));
  end if;
end;
$$;
alter table tickets add column if not exists payment_provider text;
alter table tickets add column if not exists provider_session_id text;
alter table tickets add column if not exists provider_payment_id text;
alter table tickets add column if not exists currency text;
alter table tickets add column if not exists commission_amount numeric(10, 2) check (commission_amount >= 0);
alter table tickets add column if not exists business_payout_amount numeric(10, 2) check (business_payout_amount >= 0);
alter table tickets add column if not exists paid_at timestamptz;

create unique index if not exists idx_tickets_provider_session_id
  on tickets (provider_session_id)
  where provider_session_id is not null;

create or replace function public.guard_ticket_payment()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_code text;
  v_is_paid boolean;
  v_market business_market;
begin
  if current_user in ('authenticated', 'anon') and not is_admin() then
    if tg_op = 'INSERT' then
      select e.is_paid, b.market into v_is_paid, v_market
      from events e join businesses b on b.id = e.business_id
      where e.id = new.event_id;
      if coalesce(v_is_paid, false) and v_market = 'US' then
        raise exception 'PAYMENT_REQUIRED: Bu bilet yalnızca ödeme sayfasından alınabilir';
      end if;
      new.payment_status := 'not_required';
      new.payment_provider := null;
      new.provider_session_id := null;
      new.provider_payment_id := null;
      new.currency := null;
      new.commission_amount := null;
      new.business_payout_amount := null;
      new.paid_at := null;
    else
      new.payment_status := old.payment_status;
      new.payment_provider := old.payment_provider;
      new.provider_session_id := old.provider_session_id;
      new.provider_payment_id := old.provider_payment_id;
      new.currency := old.currency;
      new.commission_amount := old.commission_amount;
      new.business_payout_amount := old.business_payout_amount;
      new.paid_at := old.paid_at;
      new.price_paid := old.price_paid;
    end if;
  end if;

  -- Ödenmemiş bilet doğrulanabilir bir QR taşımaz. trg_tickets_guard_capacity
  -- (isim sırasıyla bundan önce çalışır) insert'te QR atamış olabilir; geri al.
  if new.payment_status = 'pending' then
    new.qr_code := null;
  elsif new.payment_status in ('paid', 'not_required') and new.status = 'active' and new.qr_code is null then
    loop
      v_code := 'TKT' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
      exit when not exists (select 1 from tickets where qr_code = v_code);
    end loop;
    new.qr_code := v_code;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_tickets_payment_guard on tickets;
create trigger trg_tickets_payment_guard
  before insert or update on tickets
  for each row execute function guard_ticket_payment();

-- Faturalandırma sayfası: "dönem sonunda iptal" seçildiğinde abonelik dönem
-- bitene kadar 'active' kalır; bu işaret kullanıcıya bunu gösterir.
alter table business_subscriptions add column if not exists cancel_at_period_end boolean not null default false;

insert into public.schema_migrations_log (filename, note)
values ('20260925000500_us_ticket_payments.sql', 'bu çalıştırmada uygulandı')
on conflict (filename) do nothing;
