#!/usr/bin/env node
// AP — `npm run build` öncesi (prebuild) çalışır. Vercel'de production build'inde
// zorunlu bir ortam değişkeni eksikse build burada durur: bozuk sürüm hiç yayına
// çıkmaz, Vercel build log'unda hangi değişkenin eksik olduğu yazar.
// Preview/yerel build'de yalnızca tek satır bilgi verir. Elle: `ENV_CHECK=strict node scripts/check-env.mjs`.
// Acil durumda denetimi atlamak için SKIP_ENV_CHECK=1 (log'a uyarı düşer).
import { checkEnv, formatEnvReport, isStrictEnvCheck } from "../lib/env-spec.mjs";

if (process.env.SKIP_ENV_CHECK === "1") {
  console.warn("[check-env] SKIP_ENV_CHECK=1 — ortam denetimi ATLANDI. Eksik değişkenle çıkan sürüm sessizce bozuk çalışabilir.");
  process.exit(0);
}

const result = checkEnv(process.env);

if (!isStrictEnvCheck(process.env)) {
  // Yerel/preview: .env.local'i Next sonra yükler, burada görünmeyebilir; tek satır yeter.
  console.log(
    `[check-env] Üretim denetimi bu ortamda zorunlu değil (${result.errors.length} zorunlu, ${result.warnings.length} önerilen değişken tanımsız/hatalı). Ayrıntı: ENV_CHECK=strict node scripts/check-env.mjs`
  );
  process.exit(0);
}

if (result.errors.length) {
  console.error(
    [
      "",
      formatEnvReport(result, "[check-env] Üretim build'i durduruldu"),
      "",
      "Vercel → Project → Settings → Environment Variables (Production) içinde tanımla, sonra yeniden deploy et.",
      "",
    ].join("\n")
  );
  process.exit(1);
}
if (result.warnings.length) console.warn(formatEnvReport(result, "[check-env]"));
else console.log("[check-env] Tüm ortam değişkenleri tanımlı.");
