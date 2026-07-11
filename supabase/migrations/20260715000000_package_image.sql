-- Paket görseli: belirtilmezse formda işletmenin kapak görseli varsayılan
-- olarak kullanılır (uygulama katmanında), burada yalnız alanı ekliyoruz.

alter table packages add column image_url text;
