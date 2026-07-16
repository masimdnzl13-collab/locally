import { cn } from "@/lib/utils";

export function Scribble({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 72 12"
      className={cn("h-3 w-16 text-primary-500", className)}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2 8c6-6 12-6 18 0s12 6 18 0 12-6 18 0 8 4 12 2"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
