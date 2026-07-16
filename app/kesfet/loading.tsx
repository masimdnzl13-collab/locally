import { Skeleton } from "@/components/ui/skeleton";

export default function KesfetLoading() {
  return (
    <div className="px-4 py-6 md:px-6">
      <Skeleton className="mb-3 h-11 w-32 rounded-xl" />
      <div className="mb-6 flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-20 shrink-0 rounded-full" />
        ))}
      </div>
      <Skeleton className="mb-5 h-6 w-40 rounded-md" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-border bg-card">
            <Skeleton className="h-36 rounded-none" />
            <div className="space-y-2 p-4">
              <Skeleton className="h-3 w-16 rounded" />
              <Skeleton className="h-4 w-32 rounded" />
            </div>
            <div className="mx-5 h-px bg-border" />
            <div className="flex items-center justify-between px-5 py-4">
              <Skeleton className="h-10 w-24 rounded-lg" />
              <Skeleton className="h-6 w-12 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
