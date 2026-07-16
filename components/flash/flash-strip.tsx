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
      className="flex items-center justify-between gap-3 bg-discount-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-discount-600"
    >
      <span className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/50" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
        </span>
        Bodrum&apos;da bu akşam {count} flaş fırsat var
      </span>
      <span className="whitespace-nowrap rounded-full bg-white/20 px-2.5 py-1 text-xs">
        {countdown.label}
      </span>
    </Link>
  );
}
