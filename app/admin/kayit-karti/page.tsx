import SignupInviteGenerator from "@/components/admin/signup-invite-generator";
import { generateQrDataUrl } from "@/lib/qr";
import { US_QR_PATH } from "@/lib/us/config";

export default async function AdminSignupInvitePage() {
  // ABD saha turunda bırakılan genel QR: kısa ve kalıcı /qr bağlantısı,
  // oradan /us tanıtım sayfasına yönlenir (bkz. app/qr/route.ts).
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  const usQrUrl = `${siteUrl}${US_QR_PATH}`;
  const usQrDataUrl = await generateQrDataUrl(usQrUrl);

  return (
    <div className="mx-auto max-w-lg px-4 py-6 md:px-8 md:py-8">
      <div className="print:hidden">
        <h1 className="mb-1 text-xl font-bold tracking-tight text-navy-900">Saha Kayıt Kartı</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          İşletme adını yaz, o işletmeye özel kayıt bağlantısını ve QR kodunu üret. Kart, sahada
          işletmeciye uzatılıp okutulduğunda doğrudan kayıt ekranına düşer — işletme adı zaten
          dolu gelir, yalnızca e-posta ve şifre girmesi yeterli olur.
        </p>
      </div>
      <SignupInviteGenerator />

      <section className="mt-10 border-t border-border pt-6 print:hidden">
        <h2 className="mb-1 text-base font-bold tracking-tight text-navy-900">ABD tanıtım QR&apos;ı</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Broşür/masa kartına basılacak genel kod. <code className="text-xs">{usQrUrl}</code> adresine gider, oradan
          İngilizce tanıtım sayfasına (/us) yönlenir — hedef sonradan değişse de basılı kod geçerli kalır.
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={usQrDataUrl} alt={`QR: ${usQrUrl}`} width={200} height={200} className="rounded-md border border-border" />
        <a
          href={usQrDataUrl}
          download="locally-us-qr.png"
          className="mt-3 inline-block text-sm font-semibold text-teal-700 hover:underline"
        >
          PNG olarak indir
        </a>
      </section>
    </div>
  );
}
