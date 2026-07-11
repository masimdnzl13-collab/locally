"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { BUSINESS_CATEGORY_LABELS, type BusinessCategory } from "@/lib/types";
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
      <div className="sticky top-0 z-30 space-y-3 border-b border-slate-100 bg-white/95 px-4 pb-3 pt-4 backdrop-blur md:top-[57px] md:px-6">
        <select
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-dark-900 sm:w-auto"
        >
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {CATEGORY_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setCategory(f.value)}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                category === f.value
                  ? "border-primary bg-primary text-white"
                  : "border-slate-200 text-slate-600 hover:border-primary/40"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-6 md:px-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 text-4xl">🌤️</div>
            <p className="font-medium text-dark-900">
              Bu kategoride şu an paket yok, yakında eklenecek
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Diğer kategorilere göz atabilirsin.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((pkg) => (
              <PackageCard key={pkg.id} pkg={pkg} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
