-- =============================================================================
-- İŞLETME HATTI (saha satış takibi, ABD / WAT turu)
--
-- Sahada tanıtımı yapılan ama henüz kaydolmamış işletmeler için elle tutulan
-- aday listesi. Gerçekten kaydolmuş işletmeler zaten businesses tablosunda
-- (market = 'US'); admin ekranı (/admin/isletme-hatti) ikisini tek tabloda
-- yan yana gösterir. Aday kaydolduğunda business_id ile gerçek satıra
-- bağlanır ve tabloda o işletmenin satırıyla birleşir.
--
-- Yalnızca admin okur/yazar (is_admin()); işletme sahipleri ve anonim
-- ziyaretçiler bu tabloyu hiç göremez.
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'sales_lead_status') then
    create type sales_lead_status as enum ('tanitildi', 'ilgileniyor', 'kaydoldu', 'reddetti');
  end if;
end;
$$;

create table if not exists public.sales_leads (
  id uuid primary key default gen_random_uuid(),
  business_name text not null check (char_length(trim(business_name)) between 1 and 120),
  city text not null default '' check (char_length(city) <= 80),
  visited_on date not null default current_date,
  status sales_lead_status not null default 'tanitildi',
  contact text check (contact is null or char_length(contact) <= 160),
  notes text check (notes is null or char_length(notes) <= 1000),
  business_id uuid references public.businesses(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Bir işletme en fazla bir adaya bağlanabilir.
create unique index if not exists idx_sales_leads_business_id
  on public.sales_leads (business_id)
  where business_id is not null;
create index if not exists idx_sales_leads_visited_on on public.sales_leads (visited_on desc);

create or replace function public.touch_sales_leads_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_sales_leads_updated_at on public.sales_leads;
create trigger trg_sales_leads_updated_at
  before update on public.sales_leads
  for each row execute function public.touch_sales_leads_updated_at();

alter table public.sales_leads enable row level security;

drop policy if exists sales_leads_admin_all on public.sales_leads;
create policy sales_leads_admin_all on public.sales_leads
  for all
  using (is_admin())
  with check (is_admin());

insert into public.schema_migrations_log (filename, note)
values ('20260925000300_sales_pipeline.sql', 'bu çalıştırmada uygulandı')
on conflict (filename) do nothing;
