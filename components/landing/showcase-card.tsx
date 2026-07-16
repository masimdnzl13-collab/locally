import { TicketCard } from "@/components/ui/ticket-card";
import { Badge } from "@/components/ui/badge";
import { CategoryIcon } from "@/components/ui/category-icon";
import type { BusinessCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface ShowcaseItem {
  category: BusinessCategory;
  categoryLabel: string;
  business: string;
  title: string;
  summerPrice: number;
  todayPrice: number;
}

function formatTL(n: number) {
  return n.toLocaleString("tr-TR") + "₺";
}

export default function ShowcaseCard({
  item,
  featured = false,
  className,
}: {
  item: ShowcaseItem;
  featured?: boolean;
  className?: string;
}) {
  const savings = Math.round((1 - item.todayPrice / item.summerPrice) * 100);

  return (
    <TicketCard
      className={cn("flex flex-col transition-all duration-300 hover:-translate-y-1 hover:border-sepia-300", className)}
      bodyClassName="flex flex-1 flex-col p-0"
      stub={
        <>
          <div>
            <p className="strike-price text-xs">Yaz fiyatı: {formatTL(item.summerPrice)}</p>
            <p className="font-display mt-0.5 text-2xl font-semibold text-accent-600">
              {formatTL(item.todayPrice)}
            </p>
          </div>
          <Badge variant="accent">%{savings}</Badge>
        </>
      }
    >
      <CategoryIcon
        category={item.category}
        className={cn("w-full", featured ? "h-44" : "h-32")}
        iconClassName={featured ? "h-14 w-14" : "h-11 w-11"}
      />
      <div className="flex flex-1 flex-col p-5">
        <span className="text-xs font-semibold uppercase tracking-wide text-primary-600">
          {item.categoryLabel}
        </span>
        <p className="mt-1 text-sm font-medium text-muted-foreground">{item.business}</p>
        <h3
          className={cn(
            "mt-1 font-semibold text-ink-900",
            featured && "font-display text-xl font-medium"
          )}
        >
          {item.title}
        </h3>
        <p className="mt-2 text-xs text-muted-foreground">
          Yazın turistin ödediği masaya sen bunu ödüyorsun
        </p>
      </div>
    </TicketCard>
  );
}
