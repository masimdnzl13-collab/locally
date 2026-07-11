"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
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
    return <span className="text-xs font-semibold text-red-600">Kaldırıldı</span>;
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="text-xs font-semibold text-red-600 underline"
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
        className="font-bold text-red-600 disabled:opacity-60"
      >
        {isPending ? "..." : "Emin misin?"}
      </button>
      <button onClick={() => setConfirming(false)} className="text-slate-400">
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
      <div className="mb-4 flex gap-2">
        {(["tumu", "paket", "flas", "etkinlik"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-semibold",
              filter === k ? "bg-primary text-white" : "bg-slate-100 text-slate-500"
            )}
          >
            {k === "tumu" ? "Tümü" : KIND_LABEL[k]}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 text-xs text-slate-400">
            <tr>
              <th className="px-4 py-2.5 font-medium">Tür</th>
              <th className="px-4 py-2.5 font-medium">İçerik</th>
              <th className="px-4 py-2.5 font-medium">İşletme</th>
              <th className="px-4 py-2.5 font-medium">Durum</th>
              <th className="px-4 py-2.5 font-medium">Tarih</th>
              <th className="px-4 py-2.5 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.map((item) => (
              <tr key={`${item.kind}-${item.id}`} className="hover:bg-slate-50">
                <td className="px-4 py-2.5 text-slate-500">{KIND_LABEL[item.kind]}</td>
                <td className="max-w-[220px] truncate px-4 py-2.5 font-medium text-dark-900">
                  {item.title}
                </td>
                <td className="px-4 py-2.5 text-slate-600">{item.businessName}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-bold",
                      item.isActive ? "bg-primary/10 text-primary-700" : "bg-slate-100 text-slate-500"
                    )}
                  >
                    {item.isActive ? "Aktif" : "Pasif"}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-xs text-slate-400">{formatDate(item.createdAt)}</td>
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
