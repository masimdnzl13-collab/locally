import Link from "next/link";
import { redirect } from "next/navigation";
import { getPurchaseWithEntitlement } from "@/lib/purchases/queries";
import { generateQrDataUrl } from "@/lib/qr";

export default async function SatinAlmaBasariliPage({
  searchParams,
}: {
  searchParams: { purchase?: string };
}) {
  if (!searchParams.purchase) redirect("/kesfet");

  const purchase = await getPurchaseWithEntitlement(searchParams.purchase);

  if (!purchase || !purchase.entitlement) redirect("/kesfet");

  const qrDataUrl = await generateQrDataUrl(purchase.entitlement.qr_code);

  return (
    <section className="flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center px-6 py-10 text-center md:min-h-[calc(100dvh-4.5rem)]">
      <div className="mb-4 text-5xl">🎉</div>
      <h1 className="text-2xl font-extrabold tracking-tight text-dark-900">
        Paketin hazır!
      </h1>
      <p className="mt-2 max-w-sm text-balance text-sm text-slate-500">
        QR kodunla {purchase.package.business.name} işletmesinde kullanabilirsin.
      </p>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrDataUrl} alt="QR kod" className="h-56 w-56" />
        <p className="mt-3 text-sm font-semibold tracking-widest text-dark-900">
          {purchase.entitlement.qr_code}
        </p>
      </div>

      <p className="mt-4 text-sm text-slate-500">{purchase.package.title}</p>

      <Link
        href="/hesabim/paketlerim"
        className="mt-8 w-full max-w-xs rounded-xl bg-primary px-6 py-3.5 text-sm font-semibold text-white"
      >
        Paketlerime Git
      </Link>
    </section>
  );
}
