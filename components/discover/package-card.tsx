import Link from "next/link";
import { BUSINESS_CATEGORY_LABELS } from "@/lib/types";
import type { DiscoverPackage } from "@/lib/packages/queries";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CategoryIcon } from "@/components/ui/category-icon";

function formatTL(n: number) {
  return n.toLocaleString("tr-TR") + "₺";
}

export default function PackageCard({ pkg }: { pkg: DiscoverPackage }) {
  const savings = Math.round((1 - pkg.sale_price / pkg.summer_reference_price) * 100);

  return (
    <Link href={`/paket/${pkg.id}`} className="group block">
      <Card hoverLift className="flex flex-col overflow-hidden">
        <div className="relative h-36 overflow-hidden">
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
            <Badge variant="dark" className="absolute right-3 top-3">
              Yakında
            </Badge>
          )}
        </div>

        <div className="flex flex-1 flex-col p-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-primary-600">
            {BUSINESS_CATEGORY_LABELS[pkg.business.category]}
          </span>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {pkg.business.name}
            {pkg.business.district ? ` · ${pkg.business.district}` : ""}
          </p>
          <h3 className="mt-1 font-semibold text-foreground">{pkg.title}</h3>

          <div className="mt-3 flex items-end justify-between rounded-xl bg-muted p-3">
            <div>
              <p className="strike-price text-xs">Yaz: {formatTL(pkg.summer_reference_price)}</p>
              <p className="font-display text-xl font-semibold text-accent-500">
                Bugün: {formatTL(pkg.sale_price)}
              </p>
            </div>
            <Badge variant="accent">%{savings}</Badge>
          </div>
        </div>
      </Card>
    </Link>
  );
}
