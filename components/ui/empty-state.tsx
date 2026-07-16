import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border border-dashed border-sepia-300 bg-sand-50 px-6 py-14 text-center",
        className
      )}
    >
      <span className="stamp flex h-14 w-14 items-center justify-center text-primary-600">
        <Icon size={24} strokeWidth={1.5} />
      </span>
      <h3 className="font-display text-lg font-medium text-ink-900">{title}</h3>
      {description ? (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action}
    </div>
  );
}
