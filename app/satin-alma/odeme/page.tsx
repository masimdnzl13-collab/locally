import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCheckoutPurchase } from "@/lib/purchases/queries";
import IyzicoCheckoutEmbed from "@/components/packages/iyzico-checkout-embed";
import TestCheckoutComplete from "@/components/packages/test-checkout-complete";

function formatTL(n: number) {
  return n.toLocaleString("tr-TR") + "₺";
}

export default async function OdemePage({
  searchParams,
}: {
  searchParams: { purchase?: string };
}) {
  if (!searchParams.purchase) redirect("/kesfet");

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/giris");

  const purchase = await getCheckoutPurchase(searchParams.purchase, user.id);
  if (!purchase) redirect("/kesfet");

  if (purchase.status === "completed") {
    redirect(`/satin-alma/basarili?purchase=${purchase.id}`);
  }
  if (purchase.status === "failed") {
    redirect(`/satin-alma/basarisiz?purchase=${purchase.id}`);
  }

  const isTestMode = purchase.checkout_token?.startsWith("TEST-TOKEN-");

  return (
    <div className="mx-auto max-w-md px-6 py-10">
      <h1 className="text-xl font-extrabold tracking-tight text-dark-900">Ödeme</h1>
      <p className="mt-1 text-sm text-slate-500">
        {purchase.package.title} — {formatTL(purchase.amount)}
      </p>

      <div className="mt-6">
        {isTestMode ? (
          <TestCheckoutComplete purchaseId={purchase.id} />
        ) : purchase.checkout_form_content ? (
          <IyzicoCheckoutEmbed formContent={purchase.checkout_form_content} />
        ) : (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            Ödeme formu yüklenemedi, lütfen tekrar dene.
          </p>
        )}
      </div>
    </div>
  );
}
