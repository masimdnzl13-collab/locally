"use client";

import { useMemo, useState } from "react";
import { ChevronDown, CloudSun } from "lucide-react";
import { BUSINESS_CATEGORY_LABELS, type BusinessCategory } from "@/lib/types";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { EmptyState } from "@/components/ui/empty-state";
import { Scribble } from "@/components/ui/scribble";
import { StaggerContainer, StaggerItem } from "@/components/motion/stagger";
import PackageCard from "@/components/discover/package-card";
import type { DiscoverPackage } from "@/lib/packages/queries";

const CATEGORY_FILTERS: { value: BusinessCategory | "tumu"; label: string }[] = [
  { value: "tumu", label: "Tümü" },
  { value: "restoran", label: BUSINESS_CATEGORY_LABELS.restoran },
  { value: "kafe", label: BUSINESS_CATEGORY_LABELS.kafe },
  { value: "otel", label: BUSINESS_CATEGORY_LABELS.otel },
  { value: "beach_club", label: BUSINESS_CATEGORY_LABELS.beach_club },
  { value: "aktivite", label: BUSINESS_CATEGORY_LABELS.aktivite },
];

export default function DiscoverView({ packages }: { packages: DiscoverPackage[] }) {
  const [category, setCategory] = useState<BusinessCategory | "tumu">("tumu");

  const cities = useMemo(() => {
    const set = new Set(packages.map((p) => p.business.city));
    return set.size > 0 ? Array.from(set) : ["Bodrum"];
  }, [packages]);
  const [city, setCity] = useState(cities[0]);

  const filtered = packages.filter(
    (p) =>
      p.business.city === city &&
      (category === "tumu" || p.business.category === category)
  );

  return (
    <div>
      <div className="sticky top-0 z-30 space-y-3 border-b border-border/70 bg-background/90 px-4 pb-3 pt-4 backdrop-blur-xl md:top-[57px] md:px-6">
        <div className="relative w-full sm:w-auto sm:max-w-[220px]">
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full appearance-none rounded-xl border border-border bg-card px-4 py-2.5 pr-9 text-sm font-medium text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

        <SegmentedControl
          options={CATEGORY_FILTERS}
          value={category}
          onChange={setCategory}
          layoutId="discover-category-indicator"
          className="-mx-4 px-4 pb-1 sm:mx-0 sm:px-0"
        />
      </div>

      <div className="px-4 py-6 md:px-6">
        <div className="mb-5">
          <h2 className="font-display text-xl font-medium text-foreground">
            Bugünün fırsatları
          </h2>
          <Scribble className="mt-1 text-primary-500" />
        </div>

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
                <StaggerItem
                  key={pkg.id}
                  className={featured ? "sm:col-span-2" : undefined}
                >
                  <PackageCard pkg={pkg} featured={featured} />
                </StaggerItem>
              );
            })}
          </StaggerContainer>
        )}
      </div>
    </div>
  );
}
