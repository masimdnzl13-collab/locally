import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/current-user";
import { TEST_LAB_ENABLED } from "@/lib/config/pilot";
import { TEST_LAB_ACCOUNTS, getTestLabQrItems, getSystemStatus } from "@/lib/test-lab/queries";
import AccountCard from "@/components/test-lab/account-card";
import QrLabGrid from "@/components/test-lab/qr-lab-grid";
import SimulationPanel from "@/components/test-lab/simulation-panel";
import SystemStatusPanel from "@/components/test-lab/system-status-panel";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { robots: { index: false, follow: false } };

export default async function TestLabPage() {
  const user = await getCurrentUser();
  const allowed = TEST_LAB_ENABLED || user?.role === "admin";
  if (!allowed) notFound();

  const [qrItems, status] = await Promise.all([getTestLabQrItems(), getSystemStatus()]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-6">
      <div className="rounded-lg border border-discount-200 bg-discount-50 p-4">
        <p className="text-sm font-bold text-discount-700">🧪 Test Lab — yalnızca pilot ekibi için</p>
        <p className="mt-1 text-sm text-discount-700">
          Bu sayfa gerçek kullanıcılara asla gösterilmez ve arama motorlarına kapalı. Kapatmak
          için <code className="font-mono">lib/config/pilot.ts</code> içindeki{" "}
          <code className="font-mono">TEST_LAB_ENABLED</code> değerini <code className="font-mono">false</code>{" "}
          yap.
        </p>
      </div>

      <h1 className="mb-1 mt-6 text-2xl font-bold tracking-tight text-foreground">Test Lab</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Tek telefonla pilot testini yapabilmen için hazır hesaplar, sahte QR&apos;lar ve simülasyon
        düğmeleri.
      </p>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-navy-900">1) Hazır Test Hesapları</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {TEST_LAB_ACCOUNTS.map((acc) => (
            <AccountCard
              key={acc.email}
              label={acc.label}
              email={acc.email}
              description={acc.description}
            />
          ))}
        </div>
      </section>

      <section className="mb-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-navy-900">2) Sahte QR Laboratuvarı</h2>
          <Link
            href="/test-lab-k7m2p9x4/yazdir"
            className="text-sm font-medium text-teal-700 underline underline-offset-4"
          >
            Yazdırılabilir sayfa →
          </Link>
        </div>
        <p className="mb-3 text-sm text-muted-foreground">
          QR&apos;ı ekrandaki kameraya tut, ya da alttaki kodu &quot;Test İşletmesi&quot; hesabıyla
          panel → QR Doğrula ekranında elle yaz.
        </p>
        <QrLabGrid items={qrItems} />
      </section>

      <section className="mb-10">
        <h2 className="mb-1 text-lg font-bold text-navy-900">3) Simülasyon Düğmeleri</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Test İşletmesi ve Test Kullanıcı hesaplarını tek tıkla farklı durumlara sokar.
        </p>
        <Card>
          <CardContent className="p-4">
            <SimulationPanel />
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold text-navy-900">4) Sistem Durumu</h2>
        <SystemStatusPanel status={status} />
      </section>
    </div>
  );
}
