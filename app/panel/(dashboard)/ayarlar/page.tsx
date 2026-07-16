import { getMyBusiness } from "@/lib/business/current";
import PaymentAccountForm from "@/components/panel/payment-account-form";

export default async function AyarlarPage() {
  const business = await getMyBusiness();
  if (!business) return null;

  return (
    <div className="mx-auto max-w-xl px-4 py-6 md:px-8 md:py-8">
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-foreground">Ayarlar</h1>
      <p className="mb-6 text-sm text-muted-foreground">Ödeme Hesabı</p>
      <PaymentAccountForm business={business} />
    </div>
  );
}
