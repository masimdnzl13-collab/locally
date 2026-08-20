import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { REQUIRED_ENV_VARS, getEnvVarStatus } from "@/lib/env";
import { withTimeout } from "@/lib/supabase/with-timeout";

export const dynamic = "force-dynamic";

// Basit sistem sağlığı özeti: ayakta mı, hangi ortam değişkenleri tanımlı
// (değerleri göstermeden, sadece var/yok), Supabase'e bağlanılabiliyor mu.
// Sır sızdırmaz — tüm bu bilgi kimlik doğrulaması olmadan görülebilir
// olduğu için burada asla anahtar değeri, e-posta, kullanıcı verisi yok.
export async function GET() {
  const envStatus = getEnvVarStatus();
  const missing = REQUIRED_ENV_VARS.filter((key) => !envStatus[key]);

  let supabase: { connected: boolean; error: string | null } = {
    connected: false,
    error: "Ortam değişkenleri eksik olduğu için denenmedi",
  };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (url && anonKey) {
    try {
      const client = createClient(url, anonKey, {
        auth: { persistSession: false },
      });
      const result = await withTimeout(
        Promise.resolve(
          client.from("profiles").select("id", { count: "exact", head: true })
        ).then((res) => ({ error: res.error ? { message: res.error.message } : null })),
        3000,
        { error: { message: "Zaman aşımı (3sn)" } }
      );
      supabase = result.error
        ? { connected: false, error: result.error.message }
        : { connected: true, error: null };
    } catch (err) {
      supabase = { connected: false, error: (err as Error).message };
    }
  }

  const ok = missing.length === 0 && supabase.connected;

  return NextResponse.json(
    {
      ok,
      timestamp: new Date().toISOString(),
      env: envStatus,
      supabase,
    },
    { status: ok ? 200 : 503 }
  );
}
