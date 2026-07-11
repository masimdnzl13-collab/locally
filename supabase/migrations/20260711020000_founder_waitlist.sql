-- Kurucu 500 bekleme listesi (landing page e-posta toplama)

create table founder_waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  created_at timestamptz not null default now()
);

create unique index idx_founder_waitlist_email_lower on founder_waitlist (lower(email));

alter table founder_waitlist enable row level security;

create policy "founder_waitlist_insert_public"
  on founder_waitlist for insert
  to anon, authenticated
  with check (true);

create policy "founder_waitlist_select_admin"
  on founder_waitlist for select
  using (is_admin());
