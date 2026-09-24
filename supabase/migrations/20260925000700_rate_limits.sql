-- =============================================================================
-- P-W — HALKA AÇIK UÇLAR İÇİN RATE LIMIT (IP başına, sabit pencere)
--
-- /api/tideline/sso ve /kayit/us kayıt action'ı bunu çağırır (bkz.
-- lib/security/rate-limit.ts). Sayaç Postgres'te: Vercel'de her fonksiyon
-- örneğinin kendi belleği olduğundan bellek içi sayaç saldırganı durdurmaz.
-- Tablo client'a kapalı (RLS açık, policy yok); fonksiyonu yalnızca
-- service_role çalıştırabilir.
-- =============================================================================

create table if not exists rate_limit_buckets (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key, window_start)
);

alter table rate_limit_buckets enable row level security;

-- true: istek sınır içinde (sayıldı); false: sınır aşıldı.
create or replace function public.rate_limit_hit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_count integer;
begin
  insert into rate_limit_buckets as b (key, window_start, count)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set count = b.count + 1
  returning b.count into v_count;

  -- Tabloyu sınırlı tut: arada bir, bir günden eski pencereleri sil.
  if random() < 0.01 then
    delete from rate_limit_buckets where window_start < now() - interval '1 day';
  end if;

  return v_count <= p_limit;
end;
$$;

revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;

insert into public.schema_migrations_log (filename, note)
values ('20260925000700_rate_limits.sql', 'bu çalıştırmada uygulandı')
on conflict (filename) do nothing;
