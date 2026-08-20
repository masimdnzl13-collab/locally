import { createClient } from "@/lib/supabase/server";
import { generateQrDataUrl } from "@/lib/qr";
import { getEnvVarStatus } from "@/lib/env";
import { getDemoDataSummary, type DemoDataSummary } from "@/lib/admin/demo-actions";

export { TEST_LAB_PASSWORD, TEST_LAB_ACCOUNTS } from "@/lib/test-lab/constants";

const TEST_BUSINESS_ID = "99990001-0000-4000-8000-000000000001";

export interface TestLabQrItem {
  key: string;
  codeType: "package" | "flash" | "ticket" | "invalid";
  scenario: "valid" | "wrong_business" | "no_uses_left" | "expired" | "invalid_code";
  title: string;
  belongsTo: string;
  code: string | null;
  qrDataUrl: string | null;
  expectedResult: string;
  expectedErrorCode: string | null;
}

async function qrFor(code: string): Promise<string> {
  return generateQrDataUrl(code);
}

export async function getTestLabQrItems(): Promise<TestLabQrItem[]> {
  const supabase = createClient();
  const items: TestLabQrItem[] = [];

  // --- Paket hakları (LCL) ---
  const { data: entitlements } = await supabase
    .from("entitlements")
    .select(
      `qr_code, status, remaining_uses,
       purchase:purchases!inner(package:packages!inner(id, title, expires_at, business:businesses!inner(id, name)))`
    )
    .in("purchase_id", [
      "99990003-0000-4000-8000-000000000001",
      "99990003-0000-4000-8000-000000000002",
      "99990003-0000-4000-8000-000000000003",
      "99990003-0000-4000-8000-000000000004",
      "99990003-0000-4000-8000-000000000005",
    ]);

  for (const e of (entitlements ?? []) as unknown as Array<{
    qr_code: string;
    status: string;
    remaining_uses: number;
    purchase: {
      package: {
        id: string;
        title: string;
        expires_at: string;
        business: { id: string; name: string };
      };
    };
  }>) {
    const pkg = e.purchase.package;
    const isForeign = pkg.business.id !== TEST_BUSINESS_ID;
    const isExpired = new Date(pkg.expires_at) < new Date();
    const isExhausted = e.status !== "active" || e.remaining_uses <= 0;

    let scenario: TestLabQrItem["scenario"] = "valid";
    let expectedResult = "Başarılı — hak 1 azalır, müşteri kaydı düşer.";
    let expectedErrorCode: string | null = null;

    if (isForeign) {
      scenario = "wrong_business";
      expectedResult = "Hata: \"Bu kod sizin işletmenize ait değil\" (Test İşletmesi panelinden okutulunca)";
      expectedErrorCode = "WRONG_BUSINESS";
    } else if (isExhausted) {
      scenario = "no_uses_left";
      expectedResult = "Hata: \"Bu kodda kullanılabilir hak kalmamış\"";
      expectedErrorCode = "NO_USES_LEFT";
    } else if (isExpired) {
      scenario = "expired";
      expectedResult = "Hata: \"Paketin süresi dolmuş\"";
      expectedErrorCode = "EXPIRED";
    }

    items.push({
      key: `pkg-${e.qr_code}`,
      codeType: "package",
      scenario,
      title: pkg.title,
      belongsTo: pkg.business.name,
      code: e.qr_code,
      qrDataUrl: await qrFor(e.qr_code),
      expectedResult,
      expectedErrorCode,
    });
  }

  // Geçersiz kod — DB'de hiç karşılığı yok.
  const invalidCode = "LCL999999";
  items.push({
    key: "invalid",
    codeType: "invalid",
    scenario: "invalid_code",
    title: "Uydurma kod",
    belongsTo: "—",
    code: invalidCode,
    qrDataUrl: await qrFor(invalidCode),
    expectedResult: 'Hata: "Geçersiz kod"',
    expectedErrorCode: "INVALID_CODE",
  });

  // --- Flaş ayırtması (FLA) — geçerli örnek ---
  const { data: reservation } = await supabase
    .from("flash_deal_reservations")
    .select("confirmation_code, status, deal:flash_deals!inner(offer_text, business:businesses!inner(name))")
    .eq("id", "99990005-0000-4000-8000-000000000001")
    .maybeSingle();

  if (reservation) {
    const r = reservation as unknown as {
      confirmation_code: string;
      status: string;
      deal: { offer_text: string; business: { name: string } };
    };
    items.push({
      key: "flash-valid",
      codeType: "flash",
      scenario: r.status === "redeemed" ? "no_uses_left" : "valid",
      title: r.deal.offer_text,
      belongsTo: r.deal.business.name,
      code: r.confirmation_code,
      qrDataUrl: await qrFor(r.confirmation_code),
      expectedResult:
        r.status === "redeemed"
          ? 'Hata: "Bu ayırtma zaten kullanılmış" (ALREADY_USED)'
          : "Başarılı — ayırtma kullanılmış işaretlenir.",
      expectedErrorCode: r.status === "redeemed" ? "ALREADY_USED" : null,
    });
  }

  // --- Etkinlik bileti (TKT) — geçerli örnek ---
  const { data: ticket } = await supabase
    .from("tickets")
    .select("qr_code, status, event:events!inner(title, business:businesses!inner(name))")
    .eq("id", "99990007-0000-4000-8000-000000000001")
    .maybeSingle();

  if (ticket) {
    const t = ticket as unknown as {
      qr_code: string;
      status: string;
      event: { title: string; business: { name: string } };
    };
    items.push({
      key: "ticket-valid",
      codeType: "ticket",
      scenario: t.status === "used" ? "no_uses_left" : "valid",
      title: t.event.title,
      belongsTo: t.event.business.name,
      code: t.qr_code,
      qrDataUrl: await qrFor(t.qr_code),
      expectedResult:
        t.status === "used"
          ? 'Hata: "Bu bilet zaten kullanılmış" (ALREADY_USED)'
          : "Başarılı — bilet giriş yapılmış olarak işaretlenir.",
      expectedErrorCode: t.status === "used" ? "ALREADY_USED" : null,
    });
  }

  return items;
}

export interface SystemStatus {
  dbConnected: boolean;
  dbLatencyMs: number | null;
  dbError: string | null;
  envVars: Record<string, boolean>;
  demoData: DemoDataSummary;
  counts: {
    businesses: number;
    users: number;
    packages: number;
    purchases: number;
    events: number;
    flashDeals: number;
  };
}

export async function getSystemStatus(): Promise<SystemStatus> {
  const supabase = createClient();
  const started = Date.now();
  let dbConnected = false;
  let dbError: string | null = null;

  const { error } = await supabase.from("businesses").select("id", { count: "exact", head: true });
  if (error) {
    dbError = error.message;
  } else {
    dbConnected = true;
  }
  const dbLatencyMs = Date.now() - started;

  const [demoData, businesses, users, packages, purchases, events, flashDeals] = await Promise.all([
    getDemoDataSummary(),
    supabase.from("businesses").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("packages").select("id", { count: "exact", head: true }),
    supabase.from("purchases").select("id", { count: "exact", head: true }),
    supabase.from("events").select("id", { count: "exact", head: true }),
    supabase.from("flash_deals").select("id", { count: "exact", head: true }),
  ]);

  return {
    dbConnected,
    dbLatencyMs: dbConnected ? dbLatencyMs : null,
    dbError,
    envVars: {
      ...getEnvVarStatus(),
      NETGSM_USERCODE: Boolean(process.env.NETGSM_USERCODE),
      RESEND_API_KEY: Boolean(process.env.RESEND_API_KEY),
      IYZICO_API_KEY: Boolean(process.env.IYZICO_API_KEY),
      NEXT_PUBLIC_SITE_URL: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
      CRON_SECRET: Boolean(process.env.CRON_SECRET),
    },
    demoData,
    counts: {
      businesses: businesses.count ?? 0,
      users: users.count ?? 0,
      packages: packages.count ?? 0,
      purchases: purchases.count ?? 0,
      events: events.count ?? 0,
      flashDeals: flashDeals.count ?? 0,
    },
  };
}
