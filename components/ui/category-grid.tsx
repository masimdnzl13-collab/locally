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

/** Elegant monochrome category picker — links to /kesfet?category=X. */
export function CategoryGrid({ className }: { className?: string }) {
  return (
    <div className={cn("no-scrollbar flex gap-3 overflow-x-auto", className)}>
      {CATEGORIES.map((category) => {
        const Icon = CATEGORY_ICONS[category];
        return (
          <Link
            key={category}
            href={`/kesfet?category=${category}`}
            className="flex shrink-0 flex-col items-center gap-2 rounded-lg border border-border bg-card px-5 py-4 transition-colors hover:border-teal-300 hover:bg-teal-50/50"
          >
            <Icon size={22} strokeWidth={1.5} className="text-navy-800" />
            <span className="text-xs font-medium text-foreground">
              {BUSINESS_CATEGORY_LABELS[category]}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
