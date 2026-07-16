"use client";

import { Heart } from "lucide-react";
import { useFavorites } from "@/lib/favorites";
import { DealCard } from "@/components/ui/deal-card";
import { EmptyState } from "@/components/ui/empty-state";
import { ShelfGrid } from "@/components/ui/shelf";

export default function FavorilerimPage() {
  const { list, mounted } = useFavorites();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-foreground">Favorilerim</h1>

      {!mounted ? null : list.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="Henüz favori eklemedin"
          description="Beğendiğin kampanyaları kalp ikonuna dokunarak buraya kaydedebilirsin."
        />
      ) : (
        <ShelfGrid>
          {list.map((pkg) => (
            <DealCard key={pkg.id} pkg={pkg} />
          ))}
        </ShelfGrid>
      )}
    </div>
  );
}
