// AP — Locally'nin üretimde çalışması için gereken ortam değişkenleri, tek liste.
// Hem build öncesi betik (scripts/check-env.mjs, `npm run build` → prebuild) hem de
// sunucu açılışı (instrumentation.ts) burayı okur. Düz .mjs: Node betiği TypeScript
// derlemeden içe aktarabilsin diye.
//
// "required": eksik/yanlışsa üretim build'i ve sunucu açılmaz. Bunların çoğu
// geliştirmede boş kalınca kod sessizce test moduna düşer (SMS/e-posta simüle,
// ödeme simüle, Tideline bağlanamaz) — üretimde bu, "çalışıyor gibi görünen ama
// bozuk" bir site demek.
// "recommended": eksikse uyarı yazılır ama açılış durmaz (özellik bilinçli kapalı olabilir).
//
// Yeni bir zorunlu değişken eklediğinde: buraya ekle + .env.example'a yaz.

const isHttpsUrl = (v) => /^https:\/\/[^\s/]+/.test(v) && !/\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(v);
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
// RESEND_FROM_EMAIL "Locally <no-reply@x.com>" biçiminde de olabilir.
const hasEmail = (v) => /[^\s@<]+@[^\s@>]+\.[^\s@>]+/.test(v);

/** @typedef {{ key: string, level: "required" | "recommended", why: string, valid?: (value: string) => boolean, hint?: string }} EnvRule */

/** @type {EnvRule[]} */
export const LOCALLY_ENV_RULES = [
  { key: "NEXT_PUBLIC_SUPABASE_URL", level: "required", why: "veritabanı ve giriş", valid: isHttpsUrl, hint: "https:// ile başlayan Supabase proje adresi" },
  { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", level: "required", why: "tarayıcıdan Supabase erişimi" },
  { key: "SUPABASE_SERVICE_ROLE_KEY", level: "required", why: "cron işleri, webhook'lar, admin işlemleri" },
  { key: "NEXT_PUBLIC_SITE_URL", level: "required", why: "e-postalardaki ve ödeme dönüşündeki bağlantılar", valid: isHttpsUrl, hint: "gerçek domain, https://" },
  { key: "CRON_SECRET", level: "required", why: "cron uçları bu olmadan her çağrıyı 401 ile reddeder", valid: (v) => v.length >= 16, hint: "en az 16 karakter" },
  { key: "TIDELINE_API_URL", level: "required", why: "ABD kaydında restoran + Twilio numarası kurulumu", valid: isHttpsUrl, hint: "Tideline API'nin https adresi" },
  { key: "TIDELINE_WEB_URL", level: "required", why: "panelde Tideline sekmesi (SSO)", valid: isHttpsUrl, hint: "Tideline dashboard'un https adresi" },
  { key: "TIDELINE_JWT_SECRET", level: "required", why: "Tideline SSO ve servis çağrıları (Tideline JWT_SECRET ile aynı)", valid: (v) => v.length >= 32 && !v.includes("replace-with"), hint: "en az 32 karakter, Tideline'daki JWT_SECRET ile birebir aynı" },
  { key: "PAYPAL_CLIENT_ID", level: "required", why: "ABD abonelik ve bilet ödemeleri (yoksa ödeme simüle edilir)" },
  { key: "PAYPAL_CLIENT_SECRET", level: "required", why: "ABD abonelik ve bilet ödemeleri" },
  { key: "PAYPAL_WEBHOOK_ID", level: "required", why: "PayPal webhook imza doğrulaması (yoksa ödemeler aboneliğe yansımaz)" },
  { key: "PAYPAL_US_PLAN_ID", level: "required", why: "/kayit/us aylık abonelik planı", valid: (v) => v.startsWith("P-"), hint: "P-… ile başlayan plan kimliği" },
  { key: "PAYPAL_LIVE_MODE", level: "recommended", why: "üretimde true olmalı; değilse ödemeler PayPal SANDBOX'ına gider ve gerçek para alınmaz", valid: (v) => v === "true", hint: "true" },
  { key: "TWILIO_ACCOUNT_SID", level: "required", why: "ABD SMS'leri (yoksa SMS'ler simüle edilir, kimseye gitmez)", valid: (v) => v.startsWith("AC"), hint: "AC… ile başlar" },
  { key: "TWILIO_AUTH_TOKEN", level: "required", why: "ABD SMS'leri ve STOP webhook imza doğrulaması" },
  { key: "TWILIO_FROM_NUMBER", level: "required", why: "ABD SMS gönderen numarası", valid: (v) => /^\+1\d{10}$/.test(v), hint: "+1XXXXXXXXXX" },
  { key: "RESEND_API_KEY", level: "required", why: "e-postalar (yoksa simüle edilir, kimseye gitmez)" },
  { key: "RESEND_FROM_EMAIL", level: "required", why: "e-posta gönderen adresi", valid: hasEmail, hint: "ör. Locally <no-reply@alanadi.com>" },
  { key: "NEXT_PUBLIC_US_SUPPORT_EMAIL", level: "required", why: "/terms, /privacy ve SMS HELP yanıtındaki iletişim adresi (CCPA)", valid: isEmail },
  { key: "ANTHROPIC_API_KEY", level: "recommended", why: "panel AI kampanya asistanı (yoksa sabit örnek metinler)" },
  { key: "NETGSM_USERCODE", level: "recommended", why: "TR SMS'leri (yoksa simüle edilir)" },
  { key: "NETGSM_PASSWORD", level: "recommended", why: "TR SMS'leri" },
  { key: "NETGSM_MSGHEADER", level: "recommended", why: "TR SMS başlığı" },
  { key: "NEXT_PUBLIC_US_LEGAL_ENTITY", level: "recommended", why: "sözleşmedeki tüzel kişi (yoksa \"Locally\")" },
  { key: "NEXT_PUBLIC_US_GOVERNING_LAW", level: "recommended", why: "sözleşmedeki uygulanacak hukuk (yoksa Delaware varsayılır)" },
];

/**
 * @param {Record<string, string | undefined>} env
 * @param {EnvRule[]} [rules]
 */
export function checkEnv(env, rules = LOCALLY_ENV_RULES) {
  /** @type {{ key: string, level: EnvRule["level"], problem: string }[]} */
  const problems = [];
  for (const rule of rules) {
    const value = (env[rule.key] ?? "").trim();
    if (!value) problems.push({ key: rule.key, level: rule.level, problem: `eksik — ${rule.why}` });
    else if (rule.valid && !rule.valid(value))
      problems.push({ key: rule.key, level: rule.level, problem: `geçersiz (${rule.hint ?? "biçim hatalı"}) — ${rule.why}` });
  }
  return {
    errors: problems.filter((p) => p.level === "required"),
    warnings: problems.filter((p) => p.level === "recommended"),
  };
}

/** Konsola yazılacak, okunaklı rapor. */
export function formatEnvReport(result, heading) {
  const lines = [];
  if (result.errors.length) {
    lines.push(`${heading}: ${result.errors.length} zorunlu ortam değişkeni eksik ya da hatalı:`);
    for (const p of result.errors) lines.push(`  ✗ ${p.key}: ${p.problem}`);
  }
  if (result.warnings.length) {
    lines.push(`${result.errors.length ? "Ayrıca" : heading} — uyarılar (açılışı durdurmaz):`);
    for (const p of result.warnings) lines.push(`  ! ${p.key}: ${p.problem}`);
  }
  return lines.join("\n");
}

/**
 * Üretim denetimi ne zaman zorunlu: Vercel'in production ortamı (build ve çalışma
 * anı), ya da ENV_CHECK=strict ile elle. Preview ve yerel geliştirmede yalnızca rapor.
 * @param {Record<string, string | undefined>} env
 */
export function isStrictEnvCheck(env) {
  if (env.SKIP_ENV_CHECK === "1") return false;
  return env.VERCEL_ENV === "production" || env.ENV_CHECK === "strict";
}
