import { getMyBusiness } from "@/lib/business/current";
import PaymentAccountForm from "@/components/panel/payment-account-form";
import PanelPasswordForm from "@/components/panel/panel-password-form";
import { PILOT_MODE } from "@/lib/config/pilot";

export default async function AyarlarPage() {
  const business = await getMyBusiness();
  if (!business) return null;

  return (
    <div className="mx-auto max-w-xl px-4 py-6 md:px-8 md:py-8">
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-foreground">Ayarlar</h1>

      <section className="mb-8">
        <h2 className="mb-1 text-sm font-bold text-foreground">Şifre</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Müşteri verisi barındıran bir hesap için güçlü bir şifre seçmeni öneririz.
        </p>
        <PanelPasswordForm />
      </section>

      <section>
        <h2 className="mb-4 text-sm font-bold text-foreground">Ödeme Hesabı</h2>
        {PILOT_MODE ? (
          <div className="rounded-lg border border-border bg-muted px-4 py-4 text-sm text-muted-foreground">
            Pilot dönemde ödemeler doğrudan işletmende, mekânda alınıyor. Bu yüzden
            platform üzerinden bir ödeme hesabı oluşturmana gerek yok. Gerçek online
            ödeme dönemi başladığında bu adım tekrar aktif olacak.
          </div>
        ) : (
          <PaymentAccountForm business={business} />
        )}
      </section>
    </div>
  );
}
