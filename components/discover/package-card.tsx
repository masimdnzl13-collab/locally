import Link from "next/link";
import { BUSINESS_CATEGORY_LABELS } from "@/lib/types";
import type { DiscoverPackage } from "@/lib/packages/queries";

const CATEGORY_EMOJI: Record<string, string> = {
  restoran: "🍽️",
  kafe: "☕",
  otel: "🏨",
  beach_club: "🏖️",
  aktivite: "🎯",
  diger: "✨",
};

function formatTL(n: number) {
  return n.toLocaleString("tr-TR") + "₺";
}

export default function PackageCard({ pkg }: { pkg: DiscoverPackage }) {
  const savings = Math.round((1 - pkg.sale_price / pkg.summer_reference_price) * 100);

  return (
    <Link
      href={`/paket/${pkg.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="relative h-36 overflow-hidden bg-slate-100">
        {pkg.business.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pkg.business.cover_url}
            alt={pkg.business.name}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-5xl">
            {CATEGORY_EMOJI[pkg.business.category] ?? "✨"}
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-dark-900 backdrop-blur">
          {pkg.usage_count} kullanım
        </span>
        {!pkg.purchasable && (
          <span className="absolute right-3 top-3 rounded-full bg-dark-950/80 px-2.5 py-1 text-xs font-bold text-white">
            Yakında
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <span className="text-xs font-semibold uppercase tracking-wide text-primary-600">
          {BUSINESS_CATEGORY_LABELS[pkg.business.category]}
        </span>
        <p className="mt-0.5 text-sm text-slate-500">
          {pkg.business.name}
          {pkg.business.district ? ` · ${pkg.business.district}` : ""}
        </p>
        <h3 className="mt-1 font-bold text-dark-900">{pkg.title}</h3>

        <div className="mt-3 flex items-end justify-between rounded-xl bg-slate-50 p-3">
          <div>
            <p className="text-xs text-slate-400 line-through decoration-2">
              Yaz: {formatTL(pkg.summer_reference_price)}
            </p>
            <p className="text-xl font-extrabold text-accent-500">
              Bugün: {formatTL(pkg.sale_price)}
            </p>
          </div>
          <span className="rounded-full bg-accent/10 px-2 py-1 text-xs font-bold text-accent-700">
            %{savings}
          </span>
        </div>
      </div>
    </Link>
  );
}
