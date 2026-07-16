"use client";

import { useState } from "react";
import { CloudSun, Search } from "lucide-react";
import { BUSINESS_CATEGORY_LABELS, type BusinessCategory } from "@/lib/types";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { EmptyState } from "@/components/ui/empty-state";
import { DealCard } from "@/components/ui/deal-card";
import { StaggerContainer, StaggerItem } from "@/components/motion/stagger";
import type { DiscoverPackage } from "@/lib/packages/queries";

const CATEGORY_FILTERS: { value: BusinessCategory | "tumu"; label: string }[] = [
  { value: "tumu", label: "Tümü" },
  { value: "restoran", label: BUSINESS_CATEGORY_LABELS.restoran },
  { value: "kafe", label: BUSINESS_CATEGORY_LABELS.kafe },
  { value: "otel", label: BUSINESS_CATEGORY_LABELS.otel },
  { value: "beach_club", label: BUSINESS_CATEGORY_LABELS.beach_club },
  { value: "aktivite", label: BUSINESS_CATEGORY_LABELS.aktivite },
];

export default function DiscoverView({
  packages,
  city,
  initialQuery = "",
  initialCategory = "tumu",
}: {
  packages: DiscoverPackage[];
  city: string;
  initialQuery?: string;
  initialCategory?: BusinessCategory | "tumu";
}) {
  const [category, setCategory] = useState<BusinessCategory | "tumu">(initialCategory);
  const [query, setQuery] = useState(initialQuery);

  // `packages` is already scoped to the selected city (see app/kesfet/page.tsx) —
  // city switching happens globally via the navbar's location selector.
  const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR");

  const filtered = packages.filter((p) => {
    if (category !== "tumu" && p.business.category !== category) return false;
    if (!normalizedQuery) return true;
    return (
      p.title.toLocaleLowerCase("tr-TR").includes(normalizedQuery) ||
      p.business.name.toLocaleLowerCase("tr-TR").includes(normalizedQuery)
    );
  });

  return (
    <div>
      <div className="sticky top-0 z-30 space-y-3 border-b border-border bg-background/95 px-4 pb-3 pt-4 backdrop-blur-md md:top-[57px] md:px-6 xl:px-8">
        <div className="mx-auto max-w-[100rem]">
          <div className="relative flex h-11 items-center rounded-input border border-border bg-card px-3.5 transition-shadow focus-within:ring-2 focus-within:ring-ring">
            <Search size={17} className="shrink-0 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="İşletme veya kampanya ara"
              aria-label="İşletme veya kampanya ara"
              className="w-full bg-transparent px-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
            />
          </div>

          <SegmentedControl
            options={CATEGORY_FILTERS}
            value={category}
            onChange={setCategory}
            layoutId="discover-category-indicator"
            className="-mx-4 mt-3 px-4 pb-1 sm:mx-0 sm:px-0"
          />
        </div>
      </div>

      <div className="mx-auto max-w-[100rem] px-4 py-6 md:px-6 xl:px-8">
        <h1 className="mb-5 text-xl font-semibold tracking-tight text-foreground">
          {city} fırsatları
        </h1>

        {filtered.length === 0 ? (
          <EmptyState
            icon={CloudSun}
            title="Bu kategoride şu an paket yok, yakında eklenecek"
            description="Diğer kategorilere göz atabilirsin."
            className="py-20"
          />
        ) : (
          <StaggerContainer className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {filtered.map((pkg, i) => {
              const featured = i % 5 === 0;
              return (
                <StaggerItem key={pkg.id} className={featured ? "sm:col-span-2" : undefined}>
                  <DealCard pkg={pkg} variant={featured ? "featured" : "compact"} />
                </StaggerItem>
              );
            })}
          </StaggerContainer>
        )}
      </div>
    </div>
  );
}
