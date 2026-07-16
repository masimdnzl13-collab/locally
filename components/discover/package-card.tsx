import Link from "next/link";
import { BUSINESS_CATEGORY_LABELS } from "@/lib/types";
import type { DiscoverPackage } from "@/lib/packages/queries";
import { TicketCard } from "@/components/ui/ticket-card";
import { Badge } from "@/components/ui/badge";
import { CategoryIcon } from "@/components/ui/category-icon";
import { cn } from "@/lib/utils";

function formatTL(n: number) {
  return n.toLocaleString("tr-TR") + "₺";
}

export default function PackageCard({
  pkg,
  featured = false,
}: {
  pkg: DiscoverPackage;
  /** Purely presentational — used by the discover grid to break the uniform rhythm. */
  featured?: boolean;
}) {
  const savings = Math.round((1 - pkg.sale_price / pkg.summer_reference_price) * 100);

  return (
    <Link href={`/paket/${pkg.id}`} className="group block h-full">
      <TicketCard
        className="flex h-full flex-col transition-all duration-300 hover:-translate-y-1 hover:border-sepia-300"
        bodyClassName="flex flex-1 flex-col p-0"
        stubClassName={featured ? "sm:px-6 sm:py-5" : undefined}
        stub={
          <>
            <div>
              <p className="strike-price text-xs">Yaz: {formatTL(pkg.summer_reference_price)}</p>
              <p
                className={cn(
                  "font-display font-semibold text-accent-500",
                  featured ? "text-2xl" : "text-xl"
                )}
              >
                Bugün: {formatTL(pkg.sale_price)}
              </p>
            </div>
            <Badge variant="accent">%{savings}</Badge>
          </>
        }
      >
        <div className={cn("relative overflow-hidden", featured ? "h-48 sm:h-56" : "h-36")}>
          {pkg.business.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={pkg.business.cover_url}
              alt={pkg.business.name}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <CategoryIcon category={pkg.business.category} className="h-full" />
          )}
          <Badge variant="outline" className="absolute left-3 top-3">
            {pkg.usage_count} kullanım
          </Badge>
          {!pkg.purchasable && (
            <Badge variant="ink" className="absolute right-3 top-3">
              Yakında
            </Badge>
          )}
        </div>

        <div className={cn("flex flex-1 flex-col p-4", featured && "sm:p-6")}>
          <span className="text-xs font-semibold uppercase tracking-wide text-primary-600">
            {BUSINESS_CATEGORY_LABELS[pkg.business.category]}
          </span>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {pkg.business.name}
            {pkg.business.district ? ` · ${pkg.business.district}` : ""}
          </p>
          <h3
            className={cn(
              "mt-1 font-semibold text-foreground",
              featured && "font-display text-lg font-medium"
            )}
          >
            {pkg.title}
          </h3>
        </div>
      </TicketCard>
    </Link>
  );
}
