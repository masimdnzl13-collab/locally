"use client";

import { useEffect, useState } from "react";

export function useCountdown(targetIso: string) {
  const [remainingMs, setRemainingMs] = useState(() =>
    new Date(targetIso).getTime() - Date.now()
  );

  useEffect(() => {
    const tick = () => setRemainingMs(new Date(targetIso).getTime() - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetIso]);

  const expired = remainingMs <= 0;
  const totalSeconds = Math.max(Math.floor(remainingMs / 1000), 0);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const label = expired
    ? "Sona erdi"
    : hours > 0
      ? `${hours}s ${minutes}dk`
      : `${minutes}:${String(seconds).padStart(2, "0")}`;

  return { hours, minutes, seconds, expired, label };
}
