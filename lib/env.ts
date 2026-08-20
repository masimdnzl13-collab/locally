// Uygulamanın çalışması için gerekli ortam değişkenleri. Biri eksikse
// uygulama sessizce beyaz ekran vermemeli: konsola net bir uyarı düşer ve
// kök layout kullanıcıya anlaşılır bir hata sayfası gösterir.
export const REQUIRED_ENV_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

export type RequiredEnvVar = (typeof REQUIRED_ENV_VARS)[number];

export function getMissingEnvVars(): RequiredEnvVar[] {
  return REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
}

export function getEnvVarStatus(): Record<RequiredEnvVar, boolean> {
  return REQUIRED_ENV_VARS.reduce(
    (acc, key) => {
      acc[key] = Boolean(process.env[key]);
      return acc;
    },
    {} as Record<RequiredEnvVar, boolean>
  );
}

const missing = getMissingEnvVars();
if (missing.length > 0 && typeof window === "undefined") {
  // eslint-disable-next-line no-console
  console.error(
    `[env] Eksik ortam değişkenleri: ${missing.join(", ")} — bu değerler Vercel proje ayarlarında tanımlanmalı.`
  );
}
