#!/usr/bin/env node
// AM — Twilio hesabındaki SMS opt-out kurulumunu kontrol eder (ve istenirse düzeltir).
//
//   node scripts/twilio-sms-webhooks.mjs \
//     --locally-url https://<locally-domain> --tideline-url https://<tideline-api-domain> [--apply]
//
// TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN ortamdan okunur; TWILIO_FROM_NUMBER Locally'nin
// kendi numarasıdır (sezonluk bildirim, duyurular), diğer tüm numaralar Tideline restoran numarası sayılır.
//
// Ne kontrol edilir:
//  1. Her numaranın "A message comes in" webhook'u (SmsUrl) bizim opt-out ucumuza mı gidiyor?
//     Locally numarası → /api/webhooks/twilio/sms, restoran numaraları → /api/v1/telephony/twilio/sms.
//     --apply verilirse yanlış olanlar düzeltilir. (Yeni alınan restoran numaraları bunu
//     satın alırken zaten alır: phone-provisioning-service.ts.)
//  2. Numara bir Messaging Service'e bağlı mı? Twilio'nun "Advanced Opt-Out" özelliği yalnızca
//     Messaging Service'lerde vardır ve ayarı API'den okunamaz (yalnızca Console). Biz SMS'i
//     doğrudan numaradan (From) gönderiyoruz, Messaging Service kullanmıyoruz; bu durumda Twilio'nun
//     VARSAYILAN opt-out'u geçerlidir: STOP/START/HELP'e standart yanıtı Twilio verir ve STOP diyen
//     numaraya gönderimi 21610 hatasıyla reddeder — kapatılamaz. Bizim webhook'umuz bunun üstüne
//     tercihi kendi veritabanımıza yazar, böylece hiç denemeden bastırırız.
//     Bir numara Messaging Service'e bağlıysa Service'in "Incoming Messages" ayarı numaranın
//     SmsUrl'ünü geçersiz kılabilir; betik bunu uyarı olarak gösterir.

const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const apply = args.includes("--apply");
const sid = process.env.TWILIO_ACCOUNT_SID;
const token = process.env.TWILIO_AUTH_TOKEN;
const locallyNumber = process.env.TWILIO_FROM_NUMBER;
const locallyUrl = arg("locally-url");
const tidelineUrl = arg("tideline-url");

if (!sid || !token) {
  console.error("TWILIO_ACCOUNT_SID ve TWILIO_AUTH_TOKEN gerekli.");
  process.exit(2);
}
if (!locallyUrl || !tidelineUrl) {
  console.error("Kullanım: node scripts/twilio-sms-webhooks.mjs --locally-url https://... --tideline-url https://... [--apply]");
  process.exit(2);
}

const auth = "Basic " + Buffer.from(`${sid}:${token}`).toString("base64");
async function twilio(url, init = {}) {
  const res = await fetch(url, { ...init, headers: { Authorization: auth, ...(init.headers ?? {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${data.message ?? "istek başarısız"}`);
  return data;
}

const numbers = [];
let next = `https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers.json?PageSize=200`;
while (next) {
  const page = await twilio(next);
  numbers.push(...(page.incoming_phone_numbers ?? []));
  next = page.next_page_uri ? `https://api.twilio.com${page.next_page_uri}` : null;
}

// Messaging Service → bağlı numaralar (Advanced Opt-Out yalnızca burada yaşar).
const serviceOf = new Map();
const services = (await twilio("https://messaging.twilio.com/v1/Services?PageSize=50")).services ?? [];
for (const service of services) {
  const senders = (await twilio(`https://messaging.twilio.com/v1/Services/${service.sid}/PhoneNumbers?PageSize=200`)).phone_numbers ?? [];
  for (const s of senders) serviceOf.set(s.phone_number, service);
}

let wrong = 0;
for (const n of numbers) {
  const isLocally = locallyNumber && n.phone_number === locallyNumber.trim();
  const expected = new URL(isLocally ? "/api/webhooks/twilio/sms" : "/api/v1/telephony/twilio/sms", isLocally ? locallyUrl : tidelineUrl).toString();
  const ok = n.sms_url === expected && (n.sms_method ?? "POST").toUpperCase() === "POST";
  const service = serviceOf.get(n.phone_number);
  console.log(`${ok ? "✓" : "✗"} ${n.phone_number} (${isLocally ? "Locally" : "Tideline"})  SmsUrl=${n.sms_url || "(boş)"}`);
  if (service) {
    console.log(`    ⚠ Messaging Service "${service.friendly_name}" (${service.sid}) üyesi: Console → Messaging → Services →`);
    console.log(`      Opt-Out Management'ta Advanced Opt-Out'u kontrol et; Integration → Incoming Messages "Defer to sender's webhook" olmalı.`);
  }
  if (ok) continue;
  wrong++;
  if (apply) {
    await twilio(`https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers/${n.sid}.json`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ SmsUrl: expected, SmsMethod: "POST" }),
    });
    console.log(`    → düzeltildi: ${expected}`);
  }
}

console.log(`\n${numbers.length} numara, ${wrong} tanesi ${apply ? "düzeltildi" : "yanlış (düzeltmek için --apply)"}.`);
if (services.length === 0) console.log("Messaging Service yok → Twilio'nun varsayılan opt-out'u tüm numaralarda geçerli (21610).");
if (!apply && wrong > 0) process.exit(1);
