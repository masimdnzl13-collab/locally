"use client";

import { cn } from "@/lib/utils";

export default function SubmitButton({
  children,
  className,
  pending,
  pendingLabel = "Bir saniye...",
}: {
  children: React.ReactNode;
  className?: string;
  pending?: boolean;
  pendingLabel?: string;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "flex w-full items-center justify-center rounded-md bg-navy-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-navy-800 disabled:opacity-60",
        className
      )}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
