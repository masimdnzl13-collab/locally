const CATEGORY_STYLES: Record<string, { emoji: string; gradient: string }> = {
  kafe: { emoji: "☕", gradient: "from-primary-600 to-primary-900" },
  restoran: { emoji: "🍽️", gradient: "from-dark-700 to-dark-950" },
  beach_club: { emoji: "🏖️", gradient: "from-accent-500 to-accent-800" },
};

export interface ShowcaseItem {
  category: keyof typeof CATEGORY_STYLES;
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
  const style = CATEGORY_STYLES[item.category];
  const savings = Math.round((1 - item.todayPrice / item.summerPrice) * 100);

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div
        className={`flex h-32 items-center justify-center bg-gradient-to-br text-5xl ${style.gradient}`}
      >
        {style.emoji}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <span className="text-xs font-semibold uppercase tracking-wide text-primary-600">
          {item.categoryLabel}
        </span>
        <p className="mt-1 text-sm font-medium text-slate-500">{item.business}</p>
        <h3 className="mt-1 text-lg font-bold text-dark-900">{item.title}</h3>

        <div className="mt-4 flex items-end justify-between rounded-xl bg-slate-50 p-4">
          <div>
            <p className="text-sm text-slate-400 line-through decoration-2">
              Yaz fiyatı: {formatTL(item.summerPrice)}
            </p>
            <p className="text-2xl font-extrabold text-accent-500">
              Bugün: {formatTL(item.todayPrice)}
            </p>
          </div>
          <span className="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-bold text-accent-700">
            %{savings}
          </span>
        </div>

        <p className="mt-3 text-xs text-slate-400">
          Yazın turistin ödediği masaya sen bunu ödüyorsun
        </p>
      </div>
    </div>
  );
}
