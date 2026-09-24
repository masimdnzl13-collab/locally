import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMyBusiness } from "@/lib/business/current";
import { hasTidelineAccess } from "@/lib/tideline/access";
import { getTidelineConfig, mintTidelineAssertion } from "@/lib/tideline/sso";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

// Giriş yapmış işletme sahibine, kendi işletmesine eşlenmiş Tideline
// restoranı için 60 saniyelik, tek kullanımlık bir SSO assertion'ı verir.
// POST: yan etkili (token üretir) ve GET gibi önbelleğe/prefetch'e düşmesin.
// ?section=brain → Tideline oturum açınca doğrudan Brain (menü/saat) sayfasına
// iner (ABD onboarding menü adımı). Yalnızca bu beyaz listedeki yollar.
const SECTIONS: Record<string, string> = { brain: "/app/brain" };

export async function POST(request: Request) {
  const limited = await rateLimit("tidelineSso", clientIp(request.headers));
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Çok fazla istek. Biraz sonra tekrar dene." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
    );
  }
  const section = SECTIONS[new URL(request.url).searchParams.get("section") ?? ""];
  const config = getTidelineConfig();
  if (!config) {
    return NextResponse.json(
      { error: "Tideline bağlantısı yapılandırılmamış (TIDELINE_JWT_SECRET)." },
      { status: 503 }
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });
  }

  // getMyBusiness RLS altında yalnızca owner_id = auth.uid() satırını döner;
  // eşleme kolonlarını da yalnızca admin/service role yazabildiği için
  // (guard_business_module_mapping), buradaki restoran kimliğine güvenilebilir.
  const business = await getMyBusiness();
  if (!business || !hasTidelineAccess(business)) {
    return NextResponse.json(
      { error: "Bu işletme için Tideline etkin değil." },
      { status: 403 }
    );
  }

  const assertion = await mintTidelineAssertion({
    secret: config.secret,
    locallyUserId: user.id,
    email: user.email,
    tidelineRestaurantId: business.tideline_restaurant_id!,
  });

  // Token URL fragment'ında taşınır: tarayıcı fragment'ı hiçbir sunucuya
  // (ne Tideline'a ne log'lara) göndermez.
  return NextResponse.json(
    {
      url:
        `${config.webUrl}/sso#assertion=${encodeURIComponent(assertion)}&embedded=1` +
        (section ? `&next=${encodeURIComponent(section)}` : ""),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
