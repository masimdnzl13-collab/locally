import { notFound } from "next/navigation";
import Link from "next/link";
import { getPackageDetail } from "@/lib/packages/queries";
import { BUSINESS_CATEGORY_LABELS } from "@/lib/types";
import BuyBar from "@/components/packages/buy-bar";

function formatTL(n: number) {
  return n.toLocaleString("tr-TR") + "₺";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function PackageDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const pkg = await getPackageDetail(params.id);

  if (!pkg) notFound();

  const savings = Math.round((1 - pkg.sale_price / pkg.summer_reference_price) * 100);

  return (
    <div className="pb-40 md:pb-28">
      <div className="relative h-56 bg-slate-100 sm:h-72">
        {pkg.business.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pkg.business.cover_url}
            alt={pkg.business.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-6xl">
            🏪
          </div>
        )}
      </div>

      <div className="mx-auto max-w-2xl px-6 py-6">
        <Link
          href={`/isletme/${pkg.business.slug}`}
          className="text-sm font-medium text-primary-600 hover:underline"
        >
          {pkg.business.name}
          {pkg.business.district ? ` · ${pkg.business.district}` : ""}
        </Link>

        <span className="mt-3 block text-xs font-semibold uppercase tracking-wide text-slate-400">
          {BUSINESS_CATEGORY_LABELS[pkg.business.category]}
        </span>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-dark-900">
          {pkg.title}
        </h1>
        {pkg.description && (
          <p className="mt-2 text-sm text-slate-600">{pkg.description}</p>
        )}

        <div className="mt-6 rounded-2xl bg-slate-50 p-6 text-center">
          <p className="text-sm text-slate-400 line-through decoration-2">
            Yaz fiyatı: {formatTL(pkg.summer_reference_price)}
          </p>
          <p className="mt-1 text-4xl font-extrabold text-accent-500">
            Bugün: {formatTL(pkg.sale_price)}
          </p>
          <span className="mt-3 inline-block rounded-full bg-accent/10 px-3 py-1 text-sm font-bold text-accent-700">
            %{savings} tasarruf
          </span>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-slate-200 p-4 text-center">
            <p className="text-2xl font-extrabold text-dark-900">{pkg.usage_count}</p>
            <p className="text-xs text-slate-500">kullanım hakkı</p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4 text-center">
            <p className="text-sm font-bold text-dark-900">{formatDate(pkg.expires_at)}</p>
            <p className="text-xs text-slate-500">son kullanma tarihi</p>
          </div>
        </div>

        <section className="mt-8">
          <h2 className="mb-2 font-bold text-dark-900">Kullanım Koşulları</h2>
          <ul className="space-y-1.5 text-sm text-slate-600">
            <li>• Paket, satın alma tarihinden itibaren son kullanma tarihine kadar geçerlidir.</li>
            <li>• Her kullanım işletmede QR kodun okutulmasıyla gerçekleşir.</li>
            <li>• Kullanılmayan haklar iade edilmez.</li>
          </ul>
        </section>
      </div>

      <BuyBar packageId={pkg.id} price={pkg.sale_price} purchasable={pkg.purchasable} />
    </div>
  );
}
