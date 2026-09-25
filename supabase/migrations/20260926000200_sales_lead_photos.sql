-- AN — Mobil saha kaydı (/admin/isletme-hatti/ekle): adaya isteğe bağlı bir
-- kartvizit/tabela fotoğrafı. Dosya özel (public olmayan) bir bucket'ta durur,
-- yalnızca admin yükler/görür; tablo yalnızca yolunu tutar. Admin ekranı
-- fotoğrafı kısa ömürlü imzalı URL ile açar.

alter table public.sales_leads
  add column if not exists photo_path text check (photo_path is null or char_length(photo_path) <= 200);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sales-lead-photos', 'sales-lead-photos', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "sales_lead_photos_admin_select" on storage.objects;
create policy "sales_lead_photos_admin_select"
  on storage.objects for select
  using (bucket_id = 'sales-lead-photos' and is_admin());

drop policy if exists "sales_lead_photos_admin_insert" on storage.objects;
create policy "sales_lead_photos_admin_insert"
  on storage.objects for insert
  with check (bucket_id = 'sales-lead-photos' and is_admin());

drop policy if exists "sales_lead_photos_admin_delete" on storage.objects;
create policy "sales_lead_photos_admin_delete"
  on storage.objects for delete
  using (bucket_id = 'sales-lead-photos' and is_admin());

insert into public.schema_migrations_log (filename, note)
values ('20260926000200_sales_lead_photos.sql', 'bu çalıştırmada uygulandı')
on conflict (filename) do nothing;
