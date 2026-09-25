// AP — sunucu açılırken (Next.js instrumentation) ortam değişkenlerini denetler.
// Üretimde zorunlu bir değişken eksikse süreç açılmaz ve hangisinin eksik olduğu
// log'a yazılır. Vercel'de build öncesi denetim (scripts/check-env.mjs) aynı listeyi
// zaten uygular; bu, build'den sonra değişkeni silinmiş ya da başka bir ortamda
// (`next start`) çalışan sürümler için ikinci kilit.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { checkEnv, formatEnvReport, isStrictEnvCheck } = await import("./lib/env-spec.mjs");
  if (!isStrictEnvCheck(process.env)) return;
  const result = checkEnv(process.env);
  if (result.warnings.length) console.warn(formatEnvReport({ errors: [], warnings: result.warnings }, "[env]"));
  if (result.errors.length) {
    console.error(`\n${formatEnvReport({ errors: result.errors, warnings: [] }, "[env] Sunucu açılmıyor")}\n`);
    process.exit(1);
  }
}
