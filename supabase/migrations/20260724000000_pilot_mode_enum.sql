-- PİLOT MOD: ödeme platformdan geçmez, işletmede nakit/kart alınır.
-- Yeni purchase_status değerleri ayrı bir migration'da eklenir çünkü
-- Postgres aynı transaction içinde yeni eklenen enum değerini hemen
-- kullanmaya izin vermez (bir sonraki migration'da kullanılır).

alter type purchase_status add value 'reserved';
alter type purchase_status add value 'cancelled';

-- Bir rezervasyonun neden iptal/düşme olduğunu ayırt etmek için
-- (işletme elle iptal etti mi, yoksa uzun süre gelinmediği için
-- otomatik mi düştü).
alter table purchases add column cancelled_reason text;
