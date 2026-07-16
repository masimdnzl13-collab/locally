import Link from "next/link";
import { UtensilsCrossed, Coffee, BedDouble, Umbrella, Compass, Sparkles, type LucideIcon } from "lucide-react";
import { BUSINESS_CATEGORY_LABELS, type BusinessCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

const CATEGORY_ICONS: Record<BusinessCategory, LucideIcon> = {
  restoran: UtensilsCrossed,
  kafe: Coffee,
  otel: BedDouble,
  beach_club: Umbrella,
  aktivite: Compass,
  diger: Sparkles,
};

const CATEGORIES = Object.keys(CATEGORY_ICONS) as BusinessCategory[];

/** Apple-Maps-style category pills — links to /kesfet?category=X. */
export function CategoryGrid({ active, className }: { active?: BusinessCategory; className?: string }) {
  return (
    <div className={cn("no-scrollbar flex gap-2 overflow-x-auto", className)}>
      {CATEGORIES.map((category) => {
        const Icon = CATEGORY_ICONS[category];
        const isActive = active === category;
        return (
          <Link
            key={category}
            href={`/kesfet?category=${category}`}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition-colors",
              isActive
                ? "border-navy-900 bg-navy-900 text-white"
                : "border-border bg-card text-foreground hover:border-teal-300 hover:bg-teal-50/60"
            )}
          >
            <Icon size={17} strokeWidth={2} className={isActive ? "text-white" : "text-teal-700"} />
            {BUSINESS_CATEGORY_LABELS[category]}
          </Link>
        );
      })}
    </div>
  );
}
