-- admin_emails beyaz listesi yalnızca YENİ kayıt/girişlerde uygulanıyordu
-- (bkz. lib/auth/ensure-profile.ts). Bu migration, listeye eklenmiş ama
-- daha önce zaten normal kullanıcı olarak kayıt olmuş hesapları da tek
-- seferlik olarak admin'e yükseltir — böylece dashboard'dan admin_emails'e
-- yeni bir satır eklemek, kullanıcının tekrar giriş yapmasını beklemeden
-- hemen etkili olur (uygulama tarafı zaten her girişte de senkronize eder).
update profiles p
set role = 'admin'
from auth.users u
join admin_emails ae on ae.email = lower(trim(u.email))
where p.id = u.id
  and p.role <> 'admin';
