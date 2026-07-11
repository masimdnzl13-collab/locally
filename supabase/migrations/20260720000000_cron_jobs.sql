-- Zamanlanmış işler (Vercel Cron) için loglar, bildirim kuyruğu ve
-- işletme başına günlük özet tabloları. Bu tablolara yazma işlemi
-- yalnızca service role ile (cron uç noktalarından) yapılır; RLS burada
-- yalnızca panel/admin tarafındaki okuma erişimini sınırlar.

create table cron_logs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  status text not null,
  affected_count int not null default 0,
  message text,
  run_at timestamptz not null default now()
);

create index idx_cron_logs_job_name on cron_logs (job_name, run_at desc);

alter table cron_logs enable row level security;

create policy "cron_logs_select_admin"
  on cron_logs for select
  using (is_admin());

create table notification_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index idx_notification_queue_status on notification_queue (status, created_at);

-- Paket hatırlatmasının aynı hak için birden fazla kez kuyruğa girmesini
-- (job iki kez çalışsa bile) engeller.
create unique index idx_notification_queue_entitlement_reminder
  on notification_queue (((payload ->> 'entitlement_id')))
  where kind = 'package_expiry_reminder';

alter table notification_queue enable row level security;

create policy "notification_queue_select_admin"
  on notification_queue for select
  using (is_admin());

create table business_daily_summaries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  summary_date date not null,
  sales_count int not null default 0,
  sales_amount numeric(10, 2) not null default 0,
  redemptions_count int not null default 0,
  flash_reservations_count int not null default 0,
  tickets_count int not null default 0,
  created_at timestamptz not null default now(),
  unique (business_id, summary_date)
);

create index idx_business_daily_summaries_business_date
  on business_daily_summaries (business_id, summary_date desc);

alter table business_daily_summaries enable row level security;

create policy "business_daily_summaries_select_owner_or_admin"
  on business_daily_summaries for select
  using (owns_business(business_id) or is_admin());
