import { UtensilsCrossed, Coffee, BedDouble, Umbrella, Sparkles, Compass, type LucideIcon } from "lucide-react";
import type { BusinessCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

const CATEGORY_STYLE: Record<BusinessCategory, { icon: LucideIcon; gradient: string }> = {
  restoran: { icon: UtensilsCrossed, gradient: "from-ink-700 to-ink-950" },
  kafe: { icon: Coffee, gradient: "from-primary-500 to-primary-800" },
  otel: { icon: BedDouble, gradient: "from-ink-500 to-ink-900" },
  beach_club: { icon: Umbrella, gradient: "from-accent-400 to-accent-700" },
  aktivite: { icon: Compass, gradient: "from-primary-400 to-ink-700" },
  diger: { icon: Sparkles, gradient: "from-sepia-500 to-sepia-800" },
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
  const { icon: Icon, gradient } = CATEGORY_STYLE[category] ?? CATEGORY_STYLE.diger;

  return (
    <div
      className={cn(
        "flex items-center justify-center bg-gradient-to-br",
        gradient,
        className
      )}
    >
      <Icon className={cn("h-10 w-10 text-white/90", iconClassName)} strokeWidth={1.5} />
    </div>
  );
}
