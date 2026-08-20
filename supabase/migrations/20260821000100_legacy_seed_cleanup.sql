-- =============================================================================
-- Eski seed-demo.sql kayıtlarını (pilot öncesi elle çalıştırılmış, is_demo
-- işareti taşımayan 6 kurgusal işletme) admin panelinden GÜVENLE, TEK TEK
-- kaldırabilmek için. Toplu silme YOK — kullanıcı bunu bilerek istemedi.
--
-- Bu 6 kayıt is_demo=false olduğu için admin_clear_demo_data()'nın hiç
-- görmediği, ama is_test_fixture de olmadığı için Test Lab korumasının da
-- kapsamadığı bir "kimsenin sahiplenmediği" veri. Tespit imzası: sahibinin
-- e-postası @locally.app ile bitiyor — bu alan adı YALNIZCA seed-demo.sql
-- tarafından kullanıldı (admin_load_demo_data() @locally.test, Test Lab da
-- @locally.test kullanıyor), bu yüzden gerçek bir pilot işletmesini asla
-- yanlışlıkla işaretlemez.
-- =============================================================================

-- Listeleme: yalnızca @locally.app sahipli, is_demo=false işletmeleri döner.
create or replace function public.admin_legacy_businesses()
returns table (
  id uuid,
  name text,
  category business_category,
  city text,
  district text,
  approval_status approval_status,
  created_at timestamptz,
  owner_email text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'FORBIDDEN: Yalnızca admin görebilir';
  end if;

  return query
  select b.id, b.name, b.category, b.city, b.district, b.approval_status, b.created_at, u.email::text
  from businesses b
  join auth.users u on u.id = b.owner_id
  where not b.is_demo
    and u.email like '%@locally.app'
  order by b.created_at;
end;
$$;

revoke all on function public.admin_legacy_businesses() from public;
grant execute on function public.admin_legacy_businesses() to authenticated;

-- Silme: TEK bir işletmeyi, kendi paket/satın alma/hak geçmişiyle birlikte
-- kaldırır. Çift kilit var: is_admin() + sahibinin e-postasının @locally.app
-- ile bitmesi şartı — form alanı kurcalanıp başka bir business_id
-- gönderilse bile, o işletme bu imzayla eşleşmiyorsa fonksiyon reddeder.
-- Sahibinin başka işletmesi kalmadıysa (bu 6 kayıtta her zaman öyle) demo
-- sahibi hesabını da temizler; gerçek kullanıcı verisine hiç dokunmaz.
create or replace function public.admin_delete_legacy_business(p_business_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_owner_email text;
  v_other_businesses int;
begin
  if not is_admin() then
    raise exception 'FORBIDDEN: Yalnızca admin çalıştırabilir';
  end if;

  select owner_id into v_owner_id from businesses where id = p_business_id;
  if v_owner_id is null then
    raise exception 'NOT_FOUND: İşletme bulunamadı';
  end if;

  select email into v_owner_email from auth.users where id = v_owner_id;

  if v_owner_email is null or v_owner_email not like '%@locally.app' then
    raise exception 'NOT_LEGACY: Bu işletme eski örnek veri imzasıyla eşleşmiyor, bu fonksiyonla silinemez';
  end if;

  delete from redemptions
  where entitlement_id in (
    select e.id from entitlements e
    join purchases pu on pu.id = e.purchase_id
    join packages p on p.id = pu.package_id
    where p.business_id = p_business_id
  );

  delete from entitlements
  where purchase_id in (
    select pu.id from purchases pu
    join packages p on p.id = pu.package_id
    where p.business_id = p_business_id
  );

  delete from purchases
  where package_id in (select id from packages where business_id = p_business_id);

  -- businesses silinince packages/flash_deals/events/customers/
  -- verification_logs/announcements/flash_deal_reservations/tickets
  -- cascade ile otomatik silinir (bkz. admin_clear_demo_data() ile aynı desen).
  delete from businesses where id = p_business_id;

  select count(*) into v_other_businesses from businesses where owner_id = v_owner_id;
  if v_other_businesses = 0 then
    delete from auth.users where id = v_owner_id;
  end if;

  return jsonb_build_object('success', true);
end;
$$;

revoke all on function public.admin_delete_legacy_business(uuid) from public;
grant execute on function public.admin_delete_legacy_business(uuid) to authenticated;

insert into public.schema_migrations_log (filename, note)
values ('20260821000100_legacy_seed_cleanup.sql', 'bu çalıştırmada uygulandı')
on conflict (filename) do nothing;
