import { Skeleton } from "@/components/ui/skeleton";

export default function PaketLoading() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-6">
      <Skeleton className="aspect-[16/10] w-full rounded-lg" />
      <Skeleton className="mt-5 h-3 w-24 rounded" />
      <Skeleton className="mt-2 h-7 w-64 rounded-md" />
      <Skeleton className="mt-3 h-4 w-full rounded" />
      <Skeleton className="mt-1 h-4 w-5/6 rounded" />
      <Skeleton className="mt-6 h-14 w-full rounded-lg" />
      <Skeleton className="mt-4 h-12 w-full rounded-md" />
    </div>
  );
}
