-- =============================================================================
-- AC — ABONELİK BİTİNCE TWILIO NUMARASINI SERBEST BIRAKMA
--
-- Abonelik biten (hemen iptal ya da dönem sonu) işletmenin Tideline
-- restoranına ait Twilio numarası serbest bırakılır; aksi halde kullanılmayan
-- numara için Twilio'ya aylık ücret ödenmeye devam eder (bkz.
-- lib/billing/number-release.ts). Bu kolonlar serbest bırakmanın yapıldığını
-- (ya da gerekmediğini) işaretler ki günlük iş (/api/cron/tideline-number-release)
-- aynı aboneliği tekrar tekrar denemesin; hata olursa son hata saklanır ve
-- iş ertesi gün yeniden dener.
-- =============================================================================

alter table business_subscriptions
  add column if not exists tideline_number_released_at timestamptz,
  add column if not exists tideline_number_release_error text;

create index if not exists idx_business_subscriptions_number_release_pending
  on business_subscriptions (current_period_end)
  where tideline_number_released_at is null;

insert into public.schema_migrations_log (filename, note)
values ('20260925000800_subscription_number_release.sql', 'bu çalıştırmada uygulandı')
on conflict (filename) do nothing;
