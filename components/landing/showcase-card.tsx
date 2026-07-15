import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CategoryIcon } from "@/components/ui/category-icon";
import type { BusinessCategory } from "@/lib/types";

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

export default function ShowcaseCard({ item }: { item: ShowcaseItem }) {
  const savings = Math.round((1 - item.todayPrice / item.summerPrice) * 100);

  return (
    <Card hoverLift className="flex flex-col overflow-hidden">
      <CategoryIcon category={item.category} className="h-32" iconClassName="h-11 w-11" />
      <div className="flex flex-1 flex-col p-5">
        <span className="text-xs font-semibold uppercase tracking-wide text-primary-600">
          {item.categoryLabel}
        </span>
        <p className="mt-1 text-sm font-medium text-muted-foreground">{item.business}</p>
        <h3 className="mt-1 font-semibold text-foreground">{item.title}</h3>

        <div className="mt-4 flex items-end justify-between rounded-xl bg-muted p-4">
          <div>
            <p className="strike-price text-sm">Yaz fiyatı: {formatTL(item.summerPrice)}</p>
            <p className="font-display mt-0.5 text-2xl font-semibold text-accent-500">
              Bugün: {formatTL(item.todayPrice)}
            </p>
          </div>
          <Badge variant="accent">%{savings}</Badge>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Yazın turistin ödediği masaya sen bunu ödüyorsun
        </p>
      </div>
    </Card>
  );
}
