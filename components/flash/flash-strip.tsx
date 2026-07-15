"use client";

import Link from "next/link";
import { useCountdown } from "@/components/flash/use-countdown";

export default function FlashStrip({
  count,
  nearestEndsAt,
}: {
  count: number;
  nearestEndsAt: string;
}) {
  const countdown = useCountdown(nearestEndsAt);

  if (count === 0 || countdown.expired) return null;

  return (
    <Link
      href="/bu-aksam"
      className="flex items-center justify-between gap-3 bg-gradient-to-r from-accent-400 to-accent-600 px-4 py-2.5 text-sm font-semibold text-dark-950 transition-opacity hover:opacity-95"
    >
      <span className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-dark-950/40" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-dark-950" />
        </span>
        Bodrum&apos;da bu akşam {count} flaş fırsat var
      </span>
      <span className="whitespace-nowrap rounded-full bg-dark-950/10 px-2.5 py-1 text-xs">
        {countdown.label}
      </span>
    </Link>
  );
}
