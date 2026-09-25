// ABD pazarı (Tideline) genel sayfalarının tek kaynağı: /us, /terms, /privacy, /qr.
// Fiyat değişirse burası + Tideline'daki SUBSCRIPTION_PRICE_USD birlikte güncellenmeli
// (maliyet uyarısı eşiği o fiyatın COST_ALERT_THRESHOLD_RATIO katıdır).
export const US_MONTHLY_PRICE_USD = 199;

// Prompt D kayıt akışı (lib/onboarding-us) — sözleşme checkbox'ı /terms'e bağlanır.
export const US_SIGNUP_HREF = "/kayit/us";
export const US_TERMS_PATH = "/terms";
// AO — gizlilik politikası + veri silme / erişim talebi formu.
export const US_PRIVACY_PATH = "/privacy";
export const US_PRIVACY_EFFECTIVE_DATE = "September 26, 2026";

// lib/onboarding-us/signup.ts → AGREEMENT_VERSION ile aynı olmalı: kayıtta
// kabul edilen sürüm, /terms'te yayınlanan metnin sürümüdür.
export const US_TERMS_VERSION = "2026-09-us-v1";
export const US_TERMS_EFFECTIVE_DATE = "September 25, 2026";

// Sahada bırakılan QR kodlarının gömdüğü kısa bağlantı. Basılı QR'lar kalıcı
// olduğu için yalnızca bu yol basılır; hedefi app/qr/route.ts'ten değiştirilebilir.
export const US_QR_PATH = "/qr";
export const US_QR_TARGET = "/us?utm_source=qr&utm_medium=print&utm_campaign=field";

// Genel destek adresi; tanımsızsa sayfalar e-posta göstermez.
export const US_SUPPORT_EMAIL: string | null = process.env.NEXT_PUBLIC_US_SUPPORT_EMAIL || null;

// Sözleşmedeki tüzel kişi ve uygulanacak hukuk — yayından önce bir avukatla
// teyit edilmeli (şirket ABD'de hangi eyalette kuruluysa o yazılmalı).
export const US_LEGAL_ENTITY = process.env.NEXT_PUBLIC_US_LEGAL_ENTITY || "Locally";
export const US_GOVERNING_LAW = process.env.NEXT_PUBLIC_US_GOVERNING_LAW || "the State of Delaware";

// ABD ziyaretçisini kökten /us'e yönlendirmeyi kapatan tercih çerezi
// (?market=tr ile ayarlanır; bkz. middleware.ts).
export const MARKET_PREF_COOKIE = "locally_market";

// ABD kullanıcısının İngilizce giriş sayfası (/us altında olduğu için ayrıca
// isUsPublicPath'e eklenmesi gerekmez).
export const US_LOGIN_PATH = "/us/login";
// İngilizce şifre sıfırlama: istek formu ve e-postadaki bağlantının döndüğü sayfa.
// Supabase Auth → URL Configuration → Redirect URLs listesinde de olmalı.
export const US_FORGOT_PASSWORD_PATH = "/us/forgot-password";
export const US_RESET_PASSWORD_PATH = "/us/reset-password";

// Bu yollar kendi İngilizce başlık/altlığını çizer; Türkçe NavBar/Footer gizlenir.
// /qr bir yönlendirme ama yine de burada: hedefi ileride bir sayfaya dönerse
// Türkçe başlık görünmesin.
const US_PUBLIC_PREFIXES = ["/us", US_SIGNUP_HREF, US_QR_PATH];

export function isUsPublicPath(pathname: string | null) {
  if (!pathname) return false;
  if (pathname === US_TERMS_PATH || pathname === US_PRIVACY_PATH) return true;
  return US_PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
