-- AM — SMS opt-out (TCPA). Locally'nin kendi Twilio numarasına (TWILIO_FROM_NUMBER)
-- STOP yazan bir numaraya bir daha hiçbir SMS gitmez: sezonluk modül bildirimi,
-- duyurular, gelecekte eklenecek her tür. Kontrol tek noktada,
-- lib/notifications/service.ts sendSms içinde yapılır; bu tablo o kontrolün kaynağı.
--
-- Anahtar numaranın rakamlarıdır (E.164'ün '+' işaretsiz hali, ör. 15551234567):
-- aynı kişi "(555) 123-4567" ya da "+1 555 123 4567" olarak kayıtlı olabilir.
create table if not exists public.sms_opt_outs (
  phone_digits text primary key check (phone_digits ~ '^[0-9]{8,15}$'),
  opted_out boolean not null default true,
  -- 'sms_keyword': kişi STOP/START yazdı; 'carrier': Twilio gönderimi 21610 ile reddetti
  -- (kişi STOP demiş, webhook'u kaçırmışız).
  source text not null check (source in ('sms_keyword', 'carrier')),
  last_keyword text,
  opted_out_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Yalnızca sunucu (service role) okur/yazar; tarayıcıdan erişim yok.
alter table public.sms_opt_outs enable row level security;
revoke all on public.sms_opt_outs from anon, authenticated;

insert into public.schema_migrations_log (filename, note)
values ('20260926000100_sms_opt_outs.sql', 'bu çalıştırmada uygulandı')
on conflict (filename) do nothing;
