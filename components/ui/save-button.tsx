"use client";

import { Heart } from "lucide-react";
import { useFavorites } from "@/lib/favorites";
import type { DiscoverPackage } from "@/lib/packages/queries";
import { cn } from "@/lib/utils";

export function SaveButton({ pkg, className }: { pkg: DiscoverPackage; className?: string }) {
  const { isFavorite, toggle, mounted } = useFavorites();
  const saved = mounted && isFavorite(pkg.id);

  return (
    <button
      type="button"
      aria-label={saved ? "Favorilerden kaldır" : "Favorilere ekle"}
      aria-pressed={saved}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(pkg);
      }}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-navy-700 shadow-sm transition-transform duration-150 hover:scale-105 active:scale-95",
        className
      )}
    >
      <Heart
        size={18}
        strokeWidth={2}
        className={saved ? "fill-discount-500 text-discount-500" : "fill-none"}
      />
    </button>
  );
}
