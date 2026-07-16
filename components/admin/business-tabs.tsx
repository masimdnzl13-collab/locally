"use client";

import { useState } from "react";
import Link from "next/link";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { EmptyState } from "@/components/ui/empty-state";
import { Building2 } from "lucide-react";
import { BUSINESS_CATEGORY_LABELS } from "@/lib/types";
import type { AdminBusinessRow } from "@/lib/admin/queries";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
}

export default function BusinessTabs({
  pending,
  approved,
  suspended,
}: {
  pending: AdminBusinessRow[];
  approved: AdminBusinessRow[];
  suspended: AdminBusinessRow[];
}) {
  const [tab, setTab] = useState<"pending" | "approved" | "suspended">("pending");

  const shown = tab === "pending" ? pending : tab === "approved" ? approved : suspended;

  return (
    <div>
      <SegmentedControl
        className="mb-4 w-fit"
        options={[
          { value: "pending", label: `Bekleyen (${pending.length})` },
          { value: "approved", label: `Onaylı (${approved.length})` },
          { value: "suspended", label: `Askıda (${suspended.length})` },
        ]}
        value={tab}
        onChange={setTab}
      />

      {shown.length === 0 ? (
        <EmptyState icon={Building2} title="Bu kategoride işletme yok" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">İşletme</th>
                <th className="px-4 py-2.5 font-medium">Kategori</th>
                <th className="px-4 py-2.5 font-medium">Sahip</th>
                <th className="px-4 py-2.5 font-medium">Başvuru</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shown.map((b) => (
                <tr key={b.id} className="odd:bg-muted/60 hover:bg-muted">
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/isletmeler/${b.id}`} className="font-semibold text-teal-700 hover:underline">
                      {b.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {b.district ? `${b.district}, ` : ""}
                      {b.city}
                    </p>
                  </td>
                  <td className="px-4 py-2.5 text-foreground">{BUSINESS_CATEGORY_LABELS[b.category]}</td>
                  <td className="px-4 py-2.5 text-foreground">
                    {b.owner?.full_name ?? "—"}
                    <p className="text-xs text-muted-foreground">{b.owner?.phone ?? ""}</p>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{formatDate(b.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
