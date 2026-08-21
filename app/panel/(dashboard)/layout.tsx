import { redirect } from "next/navigation";
import { getMyBusiness } from "@/lib/business/current";
import { getCurrentUser } from "@/lib/auth/current-user";
import { signOutAction } from "@/lib/auth/actions";
import PanelShell from "@/components/panel/panel-shell";
import PasswordReminderBanner from "@/components/panel/password-reminder-banner";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [business, user] = await Promise.all([getMyBusiness(), getCurrentUser()]);

  // İşletme satırı artık kayıt anında oluşuyor (bkz. lib/business/ensure-business.ts);
  // eksikse yalnızca e-posta onayı bekleyen nadir bir yarım kayıt durumudur —
  // kendini onaracak /panel/kurulum'a yönlendirilir. Kategori/görsel/onay
  // eksikliği artık burada BEKLETİLMİYOR: sahada "kayıt ol → doğrudan panele
  // gir" akışını bozmamak için kullanıcı doğrudan panele alınır, eksikler
  // panel ana sayfasındaki kurulum kontrol listesinde tamamlanır.
  if (!business) {
    redirect("/panel/kurulum");
  }

  // "pending" (yeni kaydın varsayılan durumu) artık paneli BLOKLAMIYOR —
  // yalnızca admin'in bilinçli bir müdahalesi olan "rejected" durumu bloklar.
  // Herkese açık listelemeler (kesfet, paketler vb.) approval_status='approved'
  // filtresini ayrıca uyguluyor, bu yüzden onaysız bir işletme panelini
  // kurabilir ama halka açık görünmez.
  if (business.approval_status === "rejected") {
    return (
      <section className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-danger-50 text-3xl text-danger-700">
          ⚠️
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Başvurun onaylanmadı
        </h1>
        <p className="mt-3 max-w-sm text-balance text-sm text-muted-foreground">
          Detaylar için bizimle iletişime geçebilirsin.
        </p>
        <form action={signOutAction} className="mt-8">
          <button type="submit" className="text-sm font-medium text-muted-foreground underline underline-offset-4">
            Çıkış Yap
          </button>
        </form>
      </section>
    );
  }

  return (
    <PanelShell business={business} isMultiRole={(user?.effectiveRoles.length ?? 1) > 1}>
      {!business.password_reminder_dismissed_at && (
        <PasswordReminderBanner />
      )}
      {children}
    </PanelShell>
  );
}
