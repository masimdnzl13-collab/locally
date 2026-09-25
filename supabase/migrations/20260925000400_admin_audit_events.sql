-- =============================================================================
-- P — ADMIN ERİŞİM DENETİMİ
--
-- lib/auth/require-admin.ts'teki merkezi guard, admin sayfalarına ve admin
-- server action'larına yapılan her erişim denemesini (izin verilen ve
-- reddedilen) buraya yazar. Yazma yalnızca servis rolüyle (reddedilen
-- denemeler admin olmayan kullanıcılardan geldiği için RLS altında
-- yazılamazdı); okuma yalnızca admin.
-- =============================================================================

create table if not exists admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  email text,
  -- "/admin/moduller" gibi bir sayfa ya da "action:setWinterModule" gibi bir işlem
  target text not null,
  outcome text not null
    check (outcome in ('allowed', 'denied_unauthenticated', 'denied_not_admin')),
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_audit_events_created_at on admin_audit_events (created_at desc);
create index if not exists idx_admin_audit_events_denied
  on admin_audit_events (created_at desc) where outcome <> 'allowed';

alter table admin_audit_events enable row level security;

drop policy if exists "admin_audit_events_select_admin" on admin_audit_events;
create policy "admin_audit_events_select_admin"
  on admin_audit_events for select
  using (is_admin());

insert into public.schema_migrations_log (filename, note)
values ('20260925000400_admin_audit_events.sql', 'bu çalıştırmada uygulandı')
on conflict (filename) do nothing;
