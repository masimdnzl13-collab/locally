import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Shelf({
  title,
  href,
  hrefLabel = "Tümünü gör",
  children,
  className,
}: {
  title: string;
  href?: string;
  hrefLabel?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("py-8", className)}>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {title}
        </h2>
        {href && (
          <Link
            href={href}
            className="flex shrink-0 items-center gap-0.5 text-sm font-medium text-teal-700 transition-colors hover:text-teal-800"
          >
            {hrefLabel}
            <ChevronRight size={16} />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export function ShelfScroller({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 sm:mx-0 sm:px-0", className)}>
      {children}
    </div>
  );
}

export function ShelfGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4",
        className
      )}
    >
      {children}
    </div>
  );
}
