import { getMyBusiness } from "@/lib/business/current";
import { getHasAnyPackage, deriveOnboardingStatus } from "@/lib/business/onboarding";
import OnboardingChecklist from "@/components/panel/onboarding-checklist";

// Kurulum kontrol listesinin, menüden her zaman ulaşılabilen tam sayfa hali
// — panel ana sayfasındaki gömülü versiyonuyla aynı bileşeni kullanır,
// kurulum tamamlandıktan sonra bile buradan tekrar bakılabilir.
export default async function KurulumAdimlariPage() {
  const business = await getMyBusiness();
  if (!business) return null;

  const hasPackage = await getHasAnyPackage(business.id);
  const status = deriveOnboardingStatus(business, hasPackage);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-8 md:py-8">
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-foreground">İşletmeni Kur</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Adımları istediğin sırada tamamlayabilirsin, kaldığın yerden devam eder.
      </p>
      <OnboardingChecklist business={business} status={status} />
      {status.completed && (
        <p className="rounded-md bg-teal-50 px-4 py-3 text-sm text-teal-700">
          Kurulumun tamam! Panel ana sayfanda artık normal özet ekranını göreceksin.
        </p>
      )}
    </div>
  );
}
