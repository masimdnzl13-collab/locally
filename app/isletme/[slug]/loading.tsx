import { Skeleton } from "@/components/ui/skeleton";

export default function IsletmeLoading() {
  return (
    <div>
      <Skeleton className="h-56 w-full rounded-none md:h-72" />
      <div className="mx-auto max-w-4xl px-4 py-6 md:px-6">
        <Skeleton className="h-7 w-52 rounded-md" />
        <Skeleton className="mt-2 h-4 w-72 rounded" />
        <Skeleton className="mt-1 h-4 w-40 rounded" />

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
