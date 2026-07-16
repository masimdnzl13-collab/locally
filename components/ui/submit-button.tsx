"use client";

import { cn } from "@/lib/utils";

export default function SubmitButton({
  children,
  className,
  pending,
}: {
  children: React.ReactNode;
  className?: string;
  pending?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "flex w-full items-center justify-center rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-600 disabled:opacity-60",
        className
      )}
    >
      {pending ? "Bir saniye..." : children}
    </button>
  );
}
