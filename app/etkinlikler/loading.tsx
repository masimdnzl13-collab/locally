import { Skeleton } from "@/components/ui/skeleton";

export default function EtkinliklerLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-6">
      <Skeleton className="h-8 w-44 rounded-md" />
      <Skeleton className="mt-2 h-4 w-60 rounded" />

      <div className="mt-6 flex gap-2 overflow-hidden">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-14 shrink-0 rounded-lg" />
        ))}
      </div>

      <div className="mt-6 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-3 rounded-lg border border-border bg-card p-3 shadow-card">
            <Skeleton className="h-20 w-20 shrink-0 rounded-md" />
            <div className="flex-1 space-y-2 py-1">
              <Skeleton className="h-3 w-24 rounded" />
              <Skeleton className="h-4 w-40 rounded" />
              <Skeleton className="h-3 w-28 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
