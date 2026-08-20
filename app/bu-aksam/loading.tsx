import { Skeleton } from "@/components/ui/skeleton";

export default function BuAksamLoading() {
  return (
    <div className="bg-navy-900 px-4 py-8 md:px-6 md:py-10">
      <div className="mx-auto max-w-6xl">
        <Skeleton className="h-8 w-40 rounded-md bg-navy-800" />
        <Skeleton className="mt-2 h-4 w-56 rounded bg-navy-800" />

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-lg bg-navy-800">
              <Skeleton className="aspect-[4/3] rounded-none bg-navy-700" />
              <div className="space-y-2 p-4">
                <Skeleton className="h-3 w-20 rounded bg-navy-700" />
                <Skeleton className="h-4 w-36 rounded bg-navy-700" />
                <Skeleton className="h-3 w-24 rounded bg-navy-700" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
