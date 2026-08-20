-- Admin e-posta beyaz listesi: bu tabloda kayıtlı bir e-posta ile kayıt
-- olan (veya zaten kayıtlı olan) kullanıcıya profiles.role otomatik
-- 'admin' atanır. Sadece sunucu tarafı (service role) erişebilir; RLS
-- açık ama hiçbir policy tanımlı değil, yani client'tan asla okunamaz/yazılamaz.
create table admin_emails (
  email text primary key,
  created_at timestamptz not null default now()
);

alter table admin_emails enable row level security;

insert into admin_emails (email) values ('m.asimdnzl13@gmail.com');

-- AI kampanya asistanı kullanım logu: hangi işletme, ne zaman, hangi
-- amaçla (paket başlığı/metni veya duyuru mesajı) ne kadar istek attı.
create table ai_generation_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  kind text not null check (kind in ('paket', 'duyuru')),
  tone text,
  created_at timestamptz not null default now()
);

create index ai_generation_logs_business_id_idx on ai_generation_logs (business_id);

alter table ai_generation_logs enable row level security;

create policy "ai_generation_logs_select_owner_or_admin"
  on ai_generation_logs for select
  using (owns_business(business_id) or is_admin());

create policy "ai_generation_logs_insert_owner"
  on ai_generation_logs for insert
  with check (owns_business(business_id));
