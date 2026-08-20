import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
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
