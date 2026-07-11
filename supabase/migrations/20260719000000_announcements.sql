-- Duyuru aracı: hedef segment kaydı ve segmentteki alıcıları (telefon +
-- e-posta) güvenli biçimde döndüren fonksiyon. profiles/auth.users
-- tablolarına doğrudan erişimi olmayan işletmenin yalnızca kendi
-- müşterilerine ait iletişim bilgilerini görmesini sağlar.

alter table announcements add column target_segment text not null default 'tumu';
alter table announcements add column template_key text;

create or replace function public.get_segment_recipients(p_business_id uuid, p_segment text)
returns table (full_name text, phone text, email text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not owns_business(p_business_id) then
    raise exception 'FORBIDDEN: Bu işletmeye erişim yetkin yok';
  end if;

  return query
  select c.full_name, c.phone, u.email::text
  from customers c
  left join profiles pr on pr.phone = c.phone
  left join auth.users u on u.id = pr.id
  where c.business_id = p_business_id
    and (
      p_segment = 'tumu'
      or (p_segment = 'yeni' and c.first_visit_at is not null
          and date_trunc('month', c.first_visit_at) = date_trunc('month', now()))
      or (p_segment = 'sadik' and c.visit_count >= 3)
      or (p_segment = 'uyuyan' and c.last_visit_at is not null and c.last_visit_at < now() - interval '30 days')
    );
end;
$$;

revoke all on function public.get_segment_recipients(uuid, text) from public;
grant execute on function public.get_segment_recipients(uuid, text) to authenticated;
