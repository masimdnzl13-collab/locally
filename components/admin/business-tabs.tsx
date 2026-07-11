"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
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
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setTab("pending")}
          className={cn(
            "rounded-full px-3.5 py-1.5 text-xs font-semibold",
            tab === "pending" ? "bg-primary text-white" : "bg-slate-100 text-slate-500"
          )}
        >
          Bekleyen ({pending.length})
        </button>
        <button
          onClick={() => setTab("approved")}
          className={cn(
            "rounded-full px-3.5 py-1.5 text-xs font-semibold",
            tab === "approved" ? "bg-primary text-white" : "bg-slate-100 text-slate-500"
          )}
        >
          Onaylı ({approved.length})
        </button>
        <button
          onClick={() => setTab("suspended")}
          className={cn(
            "rounded-full px-3.5 py-1.5 text-xs font-semibold",
            tab === "suspended" ? "bg-primary text-white" : "bg-slate-100 text-slate-500"
          )}
        >
          Askıda ({suspended.length})
        </button>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white py-10 text-center text-sm text-slate-400">
          Bu kategoride işletme yok.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 text-xs text-slate-400">
              <tr>
                <th className="px-4 py-2.5 font-medium">İşletme</th>
                <th className="px-4 py-2.5 font-medium">Kategori</th>
                <th className="px-4 py-2.5 font-medium">Sahip</th>
                <th className="px-4 py-2.5 font-medium">Başvuru</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/isletmeler/${b.id}`} className="font-semibold text-primary-700">
                      {b.name}
                    </Link>
                    <p className="text-xs text-slate-400">
                      {b.district ? `${b.district}, ` : ""}
                      {b.city}
                    </p>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{BUSINESS_CATEGORY_LABELS[b.category]}</td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {b.owner?.full_name ?? "—"}
                    <p className="text-xs text-slate-400">{b.owner?.phone ?? ""}</p>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-400">{formatDate(b.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
