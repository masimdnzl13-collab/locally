export default function KesfetLoading() {
  return (
    <div className="px-4 py-6 md:px-6">
      <div className="mb-3 h-11 w-32 animate-pulse rounded-xl bg-slate-100" />
      <div className="mb-6 flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-9 w-20 shrink-0 animate-pulse rounded-full bg-slate-100" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="h-36 animate-pulse bg-slate-100" />
            <div className="space-y-2 p-4">
              <div className="h-3 w-16 animate-pulse rounded bg-slate-100" />
              <div className="h-4 w-32 animate-pulse rounded bg-slate-100" />
              <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
