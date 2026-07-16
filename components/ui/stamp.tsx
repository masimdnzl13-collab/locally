import { cn } from "@/lib/utils";

const TONE_CLASS = {
  ink: "text-ink-800",
  accent: "text-accent-700",
  primary: "text-primary-700",
  brick: "text-tile-600",
} as const;

export function Stamp({
  label,
  tone = "ink",
  className,
}: {
  label: string;
  tone?: keyof typeof TONE_CLASS;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "stamp px-3 py-1 text-[11px] font-bold uppercase",
        TONE_CLASS[tone],
        className
      )}
    >
      {label}
    </span>
  );
}
