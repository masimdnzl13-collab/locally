-- =============================================================================
-- P6 — ABD İŞLETME ONBOARDING'İ (/kayit/us)
--
-- Self-servis akış: form → ödeme (Stripe, bkz. lib/billing/subscriptions.ts)
-- → Tideline kurulumu. businesses satırı formun ilk adımında market='US',
-- active_modules='{}' (henüz hiçbir modül açık değil) olarak oluşur, çünkü
-- Stripe Checkout işletme kimliğiyle (client_reference_id) açılıyor. Ödeme
-- tamamlanınca active_modules='{tideline}' olur (kış modülü locally_core
-- değil — o P7'deki sezon geçişiyle gelir) ve Tideline'da restoran + Twilio
-- numarası istenir (bkz. lib/onboarding-us/complete.ts).
--
-- Bu tablo formdaki ABD'ye özgü alanları, sözleşme kabulünü ve kurulumun
-- nerede kaldığını tutar. Yazma YALNIZCA servis rolüyle (server action'lar);
-- sahibi kendi satırını okuyabilir, admin hepsini.
-- =============================================================================

create table if not exists us_onboarding (
  business_id uuid primary key references businesses (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  contact_name text not null,
  contact_phone text not null,
  street_address text not null,
  city text not null,
  state text not null,
  postal_code text not null,
  agreement_version text not null,
  agreement_accepted_at timestamptz not null,
  -- E-posta onayı açıkken kayıt anında oturum yok; ödeme adımına devam
  -- edebilmek için httpOnly bir çerezle eşleşen tek kullanımlık olmayan
  -- bir devam anahtarı (yalnızca sha256'sı saklanır).
  resume_token_hash text not null,
  status text not null default 'awaiting_payment'
    check (status in ('awaiting_payment', 'activating', 'active')),
  payment_mode text check (payment_mode in ('stripe', 'test')),
  payment_ref text,
  paid_at timestamptz,
  -- Tideline kurulumunun son durumu (restoran + numara). tideline_restaurant_id
  -- businesses'ta; buradaki alanlar ekranda ve admin kuyruğunda gösterilir.
  tideline_phone_number text,
  tideline_phone_status text check (tideline_phone_status in ('active', 'pending_manual')),
  provisioning_error text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_us_onboarding_owner_id on us_onboarding (owner_id);
create index if not exists idx_us_onboarding_status on us_onboarding (status);

drop trigger if exists trg_us_onboarding_updated_at on us_onboarding;
create trigger trg_us_onboarding_updated_at
  before update on us_onboarding
  for each row execute function set_updated_at();

alter table us_onboarding enable row level security;

drop policy if exists "us_onboarding_select_own_or_admin" on us_onboarding;
create policy "us_onboarding_select_own_or_admin"
  on us_onboarding for select
  using (owner_id = auth.uid() or is_admin());

insert into public.schema_migrations_log (filename, note)
values ('20260925000100_us_onboarding.sql', 'bu çalıştırmada uygulandı')
on conflict (filename) do nothing;
