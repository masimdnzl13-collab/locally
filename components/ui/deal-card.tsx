import Link from "next/link";
import { BUSINESS_CATEGORY_LABELS } from "@/lib/types";
import type { DiscoverPackage } from "@/lib/packages/queries";
import { Badge } from "@/components/ui/badge";
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

  return (
    <Link href={`/paket/${pkg.id}`} className={cn("group block h-full", className)}>
      <article className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover">
        <div className={cn("relative overflow-hidden", featured ? "aspect-[16/10]" : "aspect-[4/3]")}>
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

          <div className="absolute left-3 top-3 flex gap-1.5">
            <Badge variant="discount">%{savings}</Badge>
            {!pkg.purchasable && <Badge variant="overlay">Yakında</Badge>}
          </div>
          <SaveButton pkg={pkg} className="absolute right-3 top-3" />
        </div>

        <div className={cn("flex flex-1 flex-col gap-1 p-4", featured && "sm:p-5")}>
          <span className="text-xs font-semibold uppercase tracking-wide text-teal-700">
            {BUSINESS_CATEGORY_LABELS[pkg.business.category]}
          </span>
          <p className="text-sm text-muted-foreground">
            {pkg.business.name}
            {pkg.business.district ? ` · ${pkg.business.district}` : ""}
          </p>
          <h3
            className={cn(
              "font-semibold leading-snug text-foreground",
              featured ? "text-lg" : "text-sm"
            )}
          >
            {pkg.title}
          </h3>

          <div className="mt-auto flex items-end justify-between pt-3">
            <div>
              <p className="strike-price text-xs">{formatTL(pkg.summer_reference_price)}</p>
              <p className={cn("font-bold tabular-nums text-foreground", featured ? "text-xl" : "text-base")}>
                {formatTL(pkg.sale_price)}
              </p>
            </div>
            <span className="text-xs text-muted-foreground">{pkg.usage_count}x kullanım</span>
          </div>
        </div>
      </article>
    </Link>
  );
}
