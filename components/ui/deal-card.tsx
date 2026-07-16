import Link from "next/link";
import { BUSINESS_CATEGORY_LABELS } from "@/lib/types";
import type { DiscoverPackage } from "@/lib/packages/queries";
import { CategoryIcon } from "@/components/ui/category-icon";
import { SaveButton } from "@/components/ui/save-button";
import { cn } from "@/lib/utils";

function formatTL(n: number) {
  return n.toLocaleString("tr-TR") + "₺";
}

export function DealCard({
  pkg,
  variant = "compact",
  className,
}: {
  pkg: DiscoverPackage;
  variant?: "compact" | "featured";
  className?: string;
}) {
  const savings = Math.round((1 - pkg.sale_price / pkg.summer_reference_price) * 100);
  const featured = variant === "featured";
  // Real urgency signal from actual quota/sold_count — never a fabricated
  // "N people viewing" style claim.
  const remaining = pkg.quota !== null ? pkg.quota - pkg.sold_count : null;
  const lowStock = remaining !== null && remaining > 0 && remaining <= 5;

  return (
    <Link href={`/paket/${pkg.id}`} className={cn("group block h-full", className)}>
      <article className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover">
        <div className={cn("relative overflow-hidden", featured ? "aspect-[4/3]" : "aspect-square")}>
          {pkg.business.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={pkg.business.cover_url}
              alt={pkg.business.name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <CategoryIcon category={pkg.business.category} className="h-full w-full" />
          )}

          <div className="absolute left-0 top-3 flex flex-col items-start gap-1.5">
            <span className="rounded-r-full bg-discount-500 py-1.5 pl-3 pr-3.5 text-sm font-extrabold text-white shadow-sm">
              %{savings}
            </span>
            {lowStock && (
              <span className="ml-3 rounded-full bg-danger-500 px-2.5 py-1 text-[11px] font-bold text-white">
                Son {remaining} kontenjan
              </span>
            )}
            {!pkg.purchasable && (
              <span className="ml-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-navy-900">
                Yakında
              </span>
            )}
          </div>
          <SaveButton pkg={pkg} className="absolute right-3 top-3" />
        </div>

        <div className={cn("flex flex-1 flex-col gap-0.5 p-3.5", featured && "sm:p-4")}>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wide text-teal-700">
              {BUSINESS_CATEGORY_LABELS[pkg.business.category]}
            </span>
            {pkg.business.district && <span>· {pkg.business.district}</span>}
          </div>
          <p className="truncate text-sm text-muted-foreground">{pkg.business.name}</p>
          <h3
            className={cn(
              "font-semibold leading-snug text-foreground",
              featured ? "text-base" : "text-sm"
            )}
          >
            {pkg.title}
          </h3>

          <div className="mt-auto flex items-baseline gap-2 pt-2.5">
            <p className={cn("font-extrabold tabular-nums text-foreground", featured ? "text-2xl" : "text-lg")}>
              {formatTL(pkg.sale_price)}
            </p>
            <p className="strike-price text-xs">{formatTL(pkg.summer_reference_price)}</p>
          </div>
        </div>
      </article>
    </Link>
  );
}
