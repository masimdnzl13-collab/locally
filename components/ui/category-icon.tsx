import { UtensilsCrossed, Coffee, BedDouble, Umbrella, Sparkles, Compass, type LucideIcon } from "lucide-react";
import type { BusinessCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

// Solid fills only — no gradients, per the design system's "no random
// gradients" rule. Used as a placeholder tile when a business has no photo.
const CATEGORY_STYLE: Record<BusinessCategory, { icon: LucideIcon; fill: string }> = {
  restoran: { icon: UtensilsCrossed, fill: "bg-navy-800" },
  kafe: { icon: Coffee, fill: "bg-teal-700" },
  otel: { icon: BedDouble, fill: "bg-navy-600" },
  beach_club: { icon: Umbrella, fill: "bg-teal-600" },
  aktivite: { icon: Compass, fill: "bg-navy-700" },
  diger: { icon: Sparkles, fill: "bg-stone-600" },
};

export function CategoryIcon({
  category,
  className,
  iconClassName,
}: {
  category: BusinessCategory;
  className?: string;
  iconClassName?: string;
}) {
  const { icon: Icon, fill } = CATEGORY_STYLE[category] ?? CATEGORY_STYLE.diger;

  return (
    <div className={cn("flex items-center justify-center", fill, className)}>
      <Icon className={cn("h-10 w-10 text-white/90", iconClassName)} strokeWidth={1.5} />
    </div>
  );
}
