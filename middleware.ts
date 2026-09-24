import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { MARKET_PREF_COOKIE } from "@/lib/us/config";

// Kök domaine ABD'den gelen ziyaretçi, ABD tanıtım sayfasına (/us) gider.
// Ülke Vercel'in x-vercel-ip-country başlığından okunur (yerelde yoktur →
// yönlendirme olmaz). "?market=tr" ile gelen (ör. /us altlığındaki
// "Türkiye" bağlantısı) bir yıl boyunca yönlendirilmez — sahadaki admin
// dahil ABD'deki Türk kullanıcılar TR sitesine böyle döner.
function usMarketRedirect(request: NextRequest): NextResponse | null {
  if (request.nextUrl.pathname !== "/") return null;
  if (request.nextUrl.searchParams.get("market") === "tr") return null;
  if (request.cookies.get(MARKET_PREF_COOKIE)?.value === "tr") return null;
  if (request.headers.get("x-vercel-ip-country") !== "US") return null;
  const url = request.nextUrl.clone();
  url.pathname = "/us";
  return NextResponse.redirect(url, 307);
}

export async function middleware(request: NextRequest) {
  const redirect = usMarketRedirect(request);
  if (redirect) return redirect;

  const response = await updateSession(request);
  if (request.nextUrl.pathname === "/" && request.nextUrl.searchParams.get("market") === "tr") {
    response.cookies.set(MARKET_PREF_COOKIE, "tr", {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }
  return response;
}

// API route'ları (cron, webhook, health) kendi cookie/oturum yönetimini
// yapar ve tarayıcı oturum tazelemesine ihtiyaç duymaz; middleware'in
// kapsamı dışında tutularak hem gereksiz iş hem de olası bir Supabase
// yavaşlığının bu uçları etkilemesi önlenir. Statik dosyalar, PWA
// varlıkları ve görseller de aynı sebeple hariç.
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|workbox-.*\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
