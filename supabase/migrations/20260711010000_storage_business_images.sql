-- İşletme logo/kapak görselleri için Storage bucket ve erişim kuralları.
-- Dosya yolu biçimi: business-images/{owner_id}/{dosya}

insert into storage.buckets (id, name, public)
values ('business-images', 'business-images', true)
on conflict (id) do nothing;

create policy "business_images_public_read"
  on storage.objects for select
  using (bucket_id = 'business-images');

create policy "business_images_owner_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'business-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "business_images_owner_update"
  on storage.objects for update
  using (
    bucket_id = 'business-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "business_images_owner_delete"
  on storage.objects for delete
  using (
    bucket_id = 'business-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
