-- Etkinlik yönetimi: iptal durumu, bilet iade durumu ve panel için
-- güvenli katılımcı listesi fonksiyonu (profiles tablosuna doğrudan
-- erişimi olmayan işletmenin, yalnızca kendi etkinliğinin katılımcılarını
-- görmesini sağlar).

alter table events add column is_cancelled boolean not null default false;
alter table tickets add column refund_status text;

create or replace function public.get_event_participants(p_event_id uuid)
returns table (
  ticket_id uuid,
  full_name text,
  phone text,
  created_at timestamptz,
  status ticket_status,
  price_paid numeric,
  refund_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
begin
  select business_id into v_business_id from events where id = p_event_id;

  if v_business_id is null or not owns_business(v_business_id) then
    raise exception 'FORBIDDEN: Bu etkinliğe erişim yetkin yok';
  end if;

  return query
  select t.id, p.full_name, p.phone, t.created_at, t.status, t.price_paid, t.refund_status
  from tickets t
  join profiles p on p.id = t.user_id
  where t.event_id = p_event_id
  order by t.created_at desc;
end;
$$;

revoke all on function public.get_event_participants(uuid) from public;
grant execute on function public.get_event_participants(uuid) to authenticated;
