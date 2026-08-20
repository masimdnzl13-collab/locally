-- Demo veri seti altyapısı: hangi kayıtların demo olduğunu işaretleyen
-- bayraklar + admin panelinden tek tıkla temizleme. Gerçek verilere asla
-- dokunmaz çünkü her şey is_demo = true filtresiyle sınırlanır.

alter table profiles add column is_demo boolean not null default false;
alter table businesses add column is_demo boolean not null default false;

create index idx_profiles_is_demo on profiles (is_demo) where is_demo;
create index idx_businesses_is_demo on businesses (is_demo) where is_demo;

-- =========================================================
-- Demo veri özeti (admin panelinde tek bakışta durum göstermek için)
-- =========================================================
create or replace function public.admin_demo_data_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_businesses int;
  v_users int;
  v_packages int;
  v_purchases int;
begin
  if not is_admin() then
    raise exception 'FORBIDDEN: Yalnızca admin görebilir';
  end if;

  select count(*) into v_businesses from businesses where is_demo;
  select count(*) into v_users from profiles where is_demo;
  select count(*) into v_packages from packages p
    join businesses b on b.id = p.business_id where b.is_demo;
  select count(*) into v_purchases from purchases pu
    where pu.user_id in (select id from profiles where is_demo)
       or pu.package_id in (select id from packages p join businesses b on b.id = p.business_id where b.is_demo);

  return jsonb_build_object(
    'loaded', v_businesses > 0,
    'businesses', v_businesses,
    'users', v_users,
    'packages', v_packages,
    'purchases', v_purchases
  );
end;
$$;

revoke all on function public.admin_demo_data_summary() from public;
grant execute on function public.admin_demo_data_summary() to authenticated;

-- =========================================================
-- Demo verisini tamamen ve güvenle temizler. Yalnızca is_demo=true
-- işaretli kayıtları siler; gerçek kayıtlara asla dokunmaz. Bazı foreign
-- key'ler (purchases.package_id, redemptions.entitlement_id/business_id)
-- cascade değil, bu yüzden silme sırası önemli.
-- =========================================================
create or replace function public.admin_clear_demo_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted_businesses int;
  v_deleted_profiles int;
begin
  if not is_admin() then
    raise exception 'FORBIDDEN: Yalnızca admin çalıştırabilir';
  end if;

  delete from redemptions
  where business_id in (select id from businesses where is_demo);

  delete from entitlements
  where purchase_id in (
    select id from purchases
    where user_id in (select id from profiles where is_demo)
       or package_id in (select id from packages p join businesses b on b.id = p.business_id where b.is_demo)
  );

  delete from purchases
  where user_id in (select id from profiles where is_demo)
     or package_id in (select id from packages p join businesses b on b.id = p.business_id where b.is_demo);

  -- businesses silinince packages/flash_deals/events/customers/
  -- verification_logs/announcements/flash_deal_reservations/tickets
  -- cascade ile otomatik silinir.
  delete from businesses where is_demo;
  get diagnostics v_deleted_businesses = row_count;

  -- Kalan demo profiller (demo müşteriler + varsa artık iş. sahibi
  -- olmayanlar) auth.users üzerinden silinir, profiles cascade ile gider.
  delete from auth.users where id in (select id from profiles where is_demo);
  get diagnostics v_deleted_profiles = row_count;

  return jsonb_build_object(
    'success', true,
    'deleted_businesses', v_deleted_businesses,
    'deleted_users', v_deleted_profiles
  );
end;
$$;

revoke all on function public.admin_clear_demo_data() from public;
grant execute on function public.admin_clear_demo_data() to authenticated;
