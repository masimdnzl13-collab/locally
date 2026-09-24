-- =============================================================================
-- P2 — HESAP EŞLEME KATMANI (Locally ⇄ Tideline)
--
-- Tideline (tideline/ alt klasörü) ABD pazarı için ayrı bir Fastify +
-- PostgreSQL uygulaması; kendi veritabanı, kendi users/restaurants tabloları
-- var. Bu migration Locally tarafında bir işletmenin:
--   * hangi pazarda olduğunu (market: TR / US),
--   * hangi modülleri kullandığını (active_modules: locally_core, tideline),
--   * Tideline tarafında hangi restaurants.id satırına karşılık geldiğini
--     (tideline_restaurant_id)
-- tutar. tideline_restaurant_id bilinçli olarak FOREIGN KEY DEĞİL: iki ayrı
-- veritabanı var, bu yalnızca SSO köprüsünün (bkz. app/api/tideline/sso)
-- hangi Tideline restoranı için oturum açacağını bilmesini sağlayan bir
-- eşleme referansı.
--
-- RLS: businesses üzerindeki mevcut policy'ler (select_approved_public,
-- insert_own, update_own_or_admin, delete_own_or_admin) HİÇ değişmiyor —
-- yeni kolonlar satır bazlı olarak aynı kurallara tabi.
--
-- GÜVENLİK: bu üç kolon approval_status ile aynı sınıfta — sahibinin kendi
-- satırını güncelleyebilmesi, kendine Tideline modülü açabileceği ya da
-- (daha kötüsü) tideline_restaurant_id'yi BAŞKA birinin Tideline
-- restoranına çevirip SSO ile ona girebileceği anlamına gelmemeli. Bu
-- yüzden guard_business_approval_status ile aynı desende bir trigger,
-- admin olmayan client isteklerinde (authenticated/anon) bu kolonlara
-- yapılan değişiklikleri sessizce geri alır. service_role ve SQL Editor
-- (postgres) etkilenmez. Kolon bazlı REVOKE yerine trigger seçildi çünkü
-- Supabase'de authenticated rolünün tablo seviyesinde UPDATE/INSERT yetkisi
-- var ve Postgres'te tablo seviyesi yetki varken kolon bazlı REVOKE etkisizdir.
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'business_market') then
    create type business_market as enum ('TR', 'US');
  end if;
end;
$$;

alter table businesses
  add column if not exists market business_market not null default 'TR';

alter table businesses
  add column if not exists active_modules text[] not null default array['locally_core']::text[];

alter table businesses
  add column if not exists tideline_restaurant_id uuid;

alter table businesses drop constraint if exists businesses_active_modules_valid;
alter table businesses
  add constraint businesses_active_modules_valid
  check (active_modules <@ array['tideline', 'locally_core']::text[]);

-- Bir Tideline restoranı en fazla bir Locally işletmesine eşlenebilir.
create unique index if not exists idx_businesses_tideline_restaurant_id
  on businesses (tideline_restaurant_id)
  where tideline_restaurant_id is not null;

-- Panelde "Tideline" sekmesinin görünürlüğü market + active_modules'e bakar.
create index if not exists idx_businesses_market on businesses (market);

-- SECURITY DEFINER DEĞİL: current_user'ın isteği yapan gerçek rol
-- (authenticated / anon / service_role / postgres) olarak kalması gerekiyor.
create or replace function public.guard_business_module_mapping()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') or is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.market = 'TR';
    new.active_modules = array['locally_core']::text[];
    new.tideline_restaurant_id = null;
  else
    new.market = old.market;
    new.active_modules = old.active_modules;
    new.tideline_restaurant_id = old.tideline_restaurant_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_businesses_guard_module_mapping on businesses;
create trigger trg_businesses_guard_module_mapping
  before insert or update on businesses
  for each row execute function guard_business_module_mapping();

insert into public.schema_migrations_log (filename, note)
values ('20260822000000_tideline_account_mapping.sql', 'bu çalıştırmada uygulandı')
on conflict (filename) do nothing;
