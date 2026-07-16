"use client";

import { useCallback, useEffect, useState } from "react";
import type { DiscoverPackage } from "@/lib/packages/queries";

const STORAGE_KEY = "locally:favorites";

function readStored(): Record<string, DiscoverPackage> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, DiscoverPackage>) : {};
  } catch {
    return {};
  }
}

/**
 * Device-local favorites (no account sync — there is no favorites table in
 * the backend). Stores the full package snapshot so the favorites page can
 * render without a second fetch; real localStorage persistence, not a fake
 * UI-only toggle.
 */
export function useFavorites() {
  const [items, setItems] = useState<Record<string, DiscoverPackage>>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setItems(readStored());
    setMounted(true);
  }, []);

  const persist = useCallback((next: Record<string, DiscoverPackage>) => {
    setItems(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // storage unavailable (private mode, quota) — in-memory state still works this session
    }
  }, []);

  const isFavorite = useCallback((id: string) => id in items, [items]);

  const toggle = useCallback(
    (pkg: DiscoverPackage) => {
      const next = { ...items };
      if (next[pkg.id]) delete next[pkg.id];
      else next[pkg.id] = pkg;
      persist(next);
    },
    [items, persist]
  );

  return { list: Object.values(items), mounted, isFavorite, toggle };
}
