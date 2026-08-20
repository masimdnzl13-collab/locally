import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { withTimeout } from "@/lib/supabase/with-timeout";

// Middleware "aptal ve hızlı" kalmalı: burada veritabanı sorgusu, profil
// çekme veya rol kontrolü YAPMA. Tek işi oturum çerezini tazelemek —
// Server Component'ler cookie yazamadığı için bu adım burada zorunlu.
// Supabase yavaş/erişilemez olsa bile istek asla asılı kalmamalı, bu yüzden
// tazeleme kısa bir süre sınırıyla sarmalanmış: süre dolarsa istek
// engellenmeden geçer (fail-open).
const AUTH_REFRESH_TIMEOUT_MS = 2500;

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Supabase ortam değişkenleri eksikse (yanlış yapılandırma veya yerel
  // iskelet geliştirme) middleware tüm siteyi çökertmesin, olduğu gibi geçsin.
  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });

    await withTimeout(supabase.auth.getUser(), AUTH_REFRESH_TIMEOUT_MS, null);
  } catch {
    // Tazeleme başarısız olsa bile istek engellenmemeli.
  }

  return response;
}
