const DAY_LABELS = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cts"];

export default function WeeklyBarChart({
  data,
}: {
  data: { date: string; count: number }[];
}) {
  const max = Math.max(...data.map((d) => d.count), 1);
  const total = data.reduce((sum, d) => sum + d.count, 0);

  if (total === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Henüz QR okutma yok, ilk kullanım burada görünecek.
      </p>
    );
  }

  return (
    <div className="flex h-32 items-end gap-2">
      {data.map((d) => {
        const day = new Date(d.date).getDay();
        const heightPct = Math.max((d.count / max) * 100, d.count > 0 ? 8 : 2);
        return (
          <div key={d.date} className="flex flex-1 flex-col items-center gap-1.5">
            <span className="text-xs font-bold tabular-nums text-muted-foreground">
              {d.count || ""}
            </span>
            <div className="flex h-24 w-full items-end">
              <div
                className="w-full rounded-t-sm bg-teal-600"
                style={{ height: `${heightPct}%` }}
              />
            </div>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {DAY_LABELS[day]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
