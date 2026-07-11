import { createClient } from "@supabase/supabase-js";

// Yalnızca sunucu-taraflı, kullanıcı oturumu olmayan bağlamlar için
// (cron işleri, webhook'lar): RLS'i bypass eder. Asla client'a sızdırılmaz.
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
