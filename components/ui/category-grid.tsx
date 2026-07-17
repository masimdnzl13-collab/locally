import Link from "next/link";
import { UtensilsCrossed, Coffee, BedDouble, Umbrella, Compass, Sparkles, type LucideIcon } from "lucide-react";
import { BUSINESS_CATEGORY_LABELS, type BusinessCategory } from "@/lib/types";

const CATEGORY_ICONS: Record<BusinessCategory, LucideIcon> = {
  restoran: UtensilsCrossed,
  kafe: Coffee,
  otel: BedDouble,
  beach_club: Umbrella,
  aktivite: Compass,
  diger: Sparkles,
};

const CATEGORIES: BusinessCategory[] = ["restoran", "kafe", "otel", "beach_club", "aktivite", "diger"];

/** Category browse cards — counts are real, passed in from getBusinessCategoryCounts(). */
export function CategoryGrid({ counts }: { counts: Record<BusinessCategory, number> }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {CATEGORIES.map((category) => {
        const Icon = CATEGORY_ICONS[category];
        return (
          <Link
            key={category}
            href={`/kesfet?category=${category}`}
            className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-teal-300"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-50">
              <Icon size={20} strokeWidth={1.5} className="text-teal-700" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold text-foreground">
                {BUSINESS_CATEGORY_LABELS[category]}
              </p>
              <p className="text-xs text-muted-foreground">{counts[category]}+ işletme</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
