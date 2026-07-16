"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Badge } from "@/components/ui/badge";
import { removeContentAction } from "@/lib/admin/actions";
import type { ContentItem } from "@/lib/admin/queries";

const KIND_LABEL: Record<ContentItem["kind"], string> = {
  paket: "Paket",
  flas: "Flaş",
  etkinlik: "Etkinlik",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

function RemoveButton({ item }: { item: ContentItem }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (item.removedByAdmin) {
    return <span className="text-xs font-semibold text-danger-600">Kaldırıldı</span>;
  }

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
    startTransition(async () => {
      const formData = new FormData();
      formData.set("kind", item.kind);
      formData.set("id", item.id);
      await removeContentAction(formData);
      router.refresh();
    });
  }

  return (
    <span className="flex items-center gap-2 text-xs">
      <button
        onClick={handleRemove}
        disabled={isPending}
        className="font-bold text-danger-600 disabled:opacity-60"
      >
        {isPending ? "..." : "Emin misin?"}
      </button>
      <button onClick={() => setConfirming(false)} className="text-muted-foreground">
        Vazgeç
      </button>
    </span>
  );
}

export default function ContentModerationView({ items }: { items: ContentItem[] }) {
  const [filter, setFilter] = useState<"tumu" | ContentItem["kind"]>("tumu");

  const shown = filter === "tumu" ? items : items.filter((i) => i.kind === filter);

  return (
    <div>
      <SegmentedControl
        className="mb-4 w-fit"
        options={[
          { value: "tumu", label: "Tümü" },
          { value: "paket", label: KIND_LABEL.paket },
          { value: "flas", label: KIND_LABEL.flas },
          { value: "etkinlik", label: KIND_LABEL.etkinlik },
        ]}
        value={filter}
        onChange={setFilter}
      />

      <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Tür</th>
              <th className="px-4 py-2.5 font-medium">İçerik</th>
              <th className="px-4 py-2.5 font-medium">İşletme</th>
              <th className="px-4 py-2.5 font-medium">Durum</th>
              <th className="px-4 py-2.5 font-medium">Tarih</th>
              <th className="px-4 py-2.5 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {shown.map((item) => (
              <tr key={`${item.kind}-${item.id}`} className="odd:bg-muted/60 hover:bg-muted">
                <td className="px-4 py-2.5 text-muted-foreground">{KIND_LABEL[item.kind]}</td>
                <td className="max-w-[220px] truncate px-4 py-2.5 font-medium text-navy-900">
                  {item.title}
                </td>
                <td className="px-4 py-2.5 text-foreground">{item.businessName}</td>
                <td className="px-4 py-2.5">
                  <Badge variant={item.isActive ? "teal" : "neutral"}>
                    {item.isActive ? "Aktif" : "Pasif"}
                  </Badge>
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{formatDate(item.createdAt)}</td>
                <td className="px-4 py-2.5 text-right">
                  <RemoveButton item={item} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
