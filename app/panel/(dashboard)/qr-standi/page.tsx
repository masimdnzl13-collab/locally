import { getMyBusiness } from "@/lib/business/current";
import { createClient } from "@/lib/supabase/server";
import { generateQrDataUrl } from "@/lib/qr";
import QrStandCard from "@/components/panel/qr-stand-card";

export default async function QrStandiPage() {
  const business = await getMyBusiness();
  if (!business) return null;

  // Kurulum kontrol listesindeki "QR standı" adımının tamamlanma sinyali —
  // sayfa ilk kez görüntülendiğinde işaretlenir (bkz. lib/business/onboarding.ts).
  // Doğrudan burada, düz bir update ile yapılıyor — revalidatePath çağıran bir
  // server action'ı bir Server Component render'ı sırasında çağırmak Next.js'te
  // desteklenmiyor; zaten bu sayfanın kendisi bu istekte taze veriyle render
  // ediliyor, başka bir revalidasyona gerek yok.
  if (!business.qr_stand_viewed_at) {
    const supabase = createClient();
    await supabase
      .from("businesses")
      .update({ qr_stand_viewed_at: new Date().toISOString() })
      .eq("id", business.id);
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const profileUrl = `${siteUrl}/isletme/${business.slug}`;
  const qrDataUrl = await generateQrDataUrl(profileUrl);

  return (
    <div className="mx-auto max-w-lg px-4 py-6 md:px-8 md:py-8">
      <div className="print:hidden">
        <h1 className="mb-1 text-2xl font-bold tracking-tight text-foreground">QR Standı</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Bu QR&apos;ı masana, vitrine ya da kasaya yerleştir. Müşteriler okuttuğunda doğrudan
          Locally&apos;deki sayfana düşer.
        </p>
        {business.approval_status !== "approved" && (
          <p className="mb-6 rounded-md bg-discount-50 px-4 py-3 text-sm text-discount-900">
            İşletmen henüz onaylanmadı — bu bağlantı, admin onayından sonra canlıya geçer.
            Standı şimdiden yazdırabilirsin.
          </p>
        )}
      </div>

      <QrStandCard businessName={business.name} qrDataUrl={qrDataUrl} profileUrl={profileUrl} />
    </div>
  );
}
