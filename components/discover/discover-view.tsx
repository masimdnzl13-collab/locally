"use client";

import { useMemo, useState } from "react";
import { ChevronDown, CloudSun, Search } from "lucide-react";
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
  initialQuery = "",
  initialCategory = "tumu",
}: {
  packages: DiscoverPackage[];
  initialQuery?: string;
  initialCategory?: BusinessCategory | "tumu";
}) {
  const [category, setCategory] = useState<BusinessCategory | "tumu">(initialCategory);
  const [query, setQuery] = useState(initialQuery);

  const cities = useMemo(() => {
    const set = new Set(packages.map((p) => p.business.city));
    return set.size > 0 ? Array.from(set) : ["Bodrum"];
  }, [packages]);
  const [city, setCity] = useState(cities[0]);

  const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR");

  const filtered = packages.filter((p) => {
    if (p.business.city !== city) return false;
    if (category !== "tumu" && p.business.category !== category) return false;
    if (!normalizedQuery) return true;
    return (
      p.title.toLocaleLowerCase("tr-TR").includes(normalizedQuery) ||
      p.business.name.toLocaleLowerCase("tr-TR").includes(normalizedQuery)
    );
  });

  return (
    <div>
      <div className="sticky top-0 z-30 space-y-3 border-b border-border bg-background/95 px-4 pb-3 pt-4 backdrop-blur-md md:top-[57px] md:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex h-11 flex-1 items-center rounded-input border border-border bg-card px-3.5 transition-shadow focus-within:ring-2 focus-within:ring-ring">
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

          <div className="relative w-full sm:w-auto sm:max-w-[200px]">
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              aria-label="Şehir seç"
              className="w-full appearance-none rounded-input border border-border bg-card px-4 py-2.5 pr-9 text-sm font-medium text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <ChevronDown
              size={16}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
          </div>
        </div>

        <SegmentedControl
          options={CATEGORY_FILTERS}
          value={category}
          onChange={setCategory}
          layoutId="discover-category-indicator"
          className="-mx-4 px-4 pb-1 sm:mx-0 sm:px-0"
        />
      </div>

      <div className="px-4 py-6 md:px-6">
        <h1 className="mb-5 text-xl font-semibold tracking-tight text-foreground">
          Bugünün fırsatları
        </h1>

        {filtered.length === 0 ? (
          <EmptyState
            icon={CloudSun}
            title="Bu kategoride şu an paket yok, yakında eklenecek"
            description="Diğer kategorilere göz atabilirsin."
            className="py-20"
          />
        ) : (
          <StaggerContainer className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
