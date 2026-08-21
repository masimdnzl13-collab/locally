import SignupInviteGenerator from "@/components/admin/signup-invite-generator";

export default function AdminSignupInvitePage() {
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
    </div>
  );
}
