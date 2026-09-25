-- =============================================================================
-- P-V — ABD ONBOARDING: MENÜ/SAAT (BRAIN) ADIMI
--
-- Ödeme + Tideline kurulumundan sonra başvuru artık doğrudan 'active' olmaz:
-- 'awaiting_menu' durumunda bekler. Tideline'da en az bir günün çalışma saati
-- ve MIN_MENU_ITEMS (lib/onboarding-us/complete.ts) aktif menü kalemi
-- girilince 'active' olur. Bu veri olmadan Tideline'ın AI asistanı arayana
-- saat/menü sorularında doğru cevap veremez.
--
-- Akış: awaiting_payment → activating → awaiting_menu → active
-- =============================================================================

alter table us_onboarding drop constraint if exists us_onboarding_status_check;
alter table us_onboarding
  add constraint us_onboarding_status_check
  check (status in ('awaiting_payment', 'activating', 'awaiting_menu', 'active'));

-- Menü adımı yokken 'active' olmuş başvurular: sahibinin durum sayfasına bir
-- sonraki girişinde Tideline'daki veriye bakılır; menü zaten girildiyse
-- hemen yeniden 'active' olur, girilmediyse "menünüzü ekleyin" uyarısı çıkar.
update us_onboarding
set status = 'awaiting_menu', completed_at = null
where status = 'active';

insert into public.schema_migrations_log (filename, note)
values ('20260925000600_us_onboarding_menu_step.sql', 'bu çalıştırmada uygulandı')
on conflict (filename) do nothing;
