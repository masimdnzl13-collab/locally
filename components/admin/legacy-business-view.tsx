"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { deleteLegacyBusinessAction } from "@/lib/admin/actions";
import { BUSINESS_CATEGORY_LABELS } from "@/lib/types";
import type { LegacyBusinessRow } from "@/lib/admin/queries";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
}

function RemoveButton({ business }: { business: LegacyBusinessRow }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="text-xs font-semibold text-danger-600 underline underline-offset-2"
      >
        Kaldır
      </button>
    );
  }

  function handleRemove() {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("businessId", business.id);
      const result = await deleteLegacyBusinessAction(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <span className="flex items-center gap-2 text-xs">
        <button
          onClick={handleRemove}
          disabled={isPending}
          className="font-bold text-danger-600 disabled:opacity-60"
        >
          {isPending ? "..." : "Kalıcı olarak sil, emin misin?"}
        </button>
        <button onClick={() => setConfirming(false)} className="text-muted-foreground">
          Vazgeç
        </button>
      </span>
      {error && <span className="text-xs text-danger-600">{error}</span>}
    </div>
  );
}

export default function LegacyBusinessView({ businesses }: { businesses: LegacyBusinessRow[] }) {
  if (businesses.length === 0) {
    return (
      <EmptyState
        icon={Archive}
        title="Temiz — eski örnek veri kalmamış"
        description="Pilot öncesi elle yüklenmiş, sahiplenilmemiş bir işletme bulunamadı."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-card">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 font-medium">İşletme</th>
            <th className="px-4 py-2.5 font-medium">Kategori</th>
            <th className="px-4 py-2.5 font-medium">Konum</th>
            <th className="px-4 py-2.5 font-medium">Sahip (e-posta)</th>
            <th className="px-4 py-2.5 font-medium">Oluşturulma</th>
            <th className="px-4 py-2.5 font-medium"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {businesses.map((b) => (
            <tr key={b.id} className="odd:bg-muted/60 hover:bg-muted">
              <td className="max-w-[200px] truncate px-4 py-2.5 font-medium text-navy-900">{b.name}</td>
              <td className="px-4 py-2.5 text-foreground">{BUSINESS_CATEGORY_LABELS[b.category]}</td>
              <td className="px-4 py-2.5 text-foreground">
                {b.district ? `${b.district}, ${b.city}` : b.city}
              </td>
              <td className="max-w-[200px] truncate px-4 py-2.5 font-mono text-xs text-muted-foreground">
                {b.owner_email}
              </td>
              <td className="px-4 py-2.5 text-xs text-muted-foreground">{formatDate(b.created_at)}</td>
              <td className="px-4 py-2.5 text-right">
                <RemoveButton business={b} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
