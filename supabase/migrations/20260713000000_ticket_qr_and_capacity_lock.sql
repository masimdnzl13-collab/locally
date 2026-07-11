-- Biletlere benzersiz QR kodu ekler ve kontenjan kontrolünü
-- (events satırını kilitleyerek) eşzamanlılığa karşı güvenli hale getirir.

alter table tickets add column qr_code text unique;

-- Bir kullanıcının aynı etkinliğe birden fazla aktif bilet/kayıt açmasını
-- (ör. çift tıklama) engeller.
create unique index idx_tickets_event_user_active
  on tickets (event_id, user_id)
  where status = 'active';

create or replace function public.guard_ticket_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capacity int;
  v_active_count int;
  v_code text;
begin
  -- events satırını kilitle: aynı etkinliğe eşzamanlı gelen kayıtlar
  -- sıraya girer, kontenjan sayımı güvenilir olur.
  select capacity into v_capacity from events where id = new.event_id for update;

  if v_capacity is not null then
    select count(*) into v_active_count
    from tickets
    where event_id = new.event_id and status = 'active';

    if v_active_count >= v_capacity then
      raise exception 'EVENT_FULL: Etkinlik kontenjanı dolu';
    end if;
  end if;

  if new.qr_code is null then
    loop
      v_code := 'TKT' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
      exit when not exists (select 1 from tickets where qr_code = v_code);
    end loop;
    new.qr_code := v_code;
  end if;

  return new;
end;
$$;
