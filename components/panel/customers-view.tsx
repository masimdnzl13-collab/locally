"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Customer } from "@/lib/customers/queries";
import { SEGMENTS, matchesSegment, type Segment } from "@/lib/customers/segments";

function formatDate(iso: string | null) {
  if (!iso) return "Henüz ziyaret yok";
  return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

export default function CustomersView({ customers }: { customers: Customer[] }) {
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState<Segment>("tumu");

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const summary = useMemo(() => {
    const total = customers.length;
    const newThisMonth = customers.filter(
      (c) => c.first_visit_at && new Date(c.first_visit_at) >= startOfMonth
    ).length;
    const repeatThisMonth = customers.filter(
      (c) =>
        c.visit_count > 1 && c.last_visit_at && new Date(c.last_visit_at) >= startOfMonth
    ).length;
    return { total, newThisMonth, repeatThisMonth };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers]);

  const filtered = customers.filter((c) => {
    if (!matchesSegment(c, segment)) return false;
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return (c.full_name ?? "").toLowerCase().includes(q) || c.phone.includes(q);
  });

  return (
    <div>
      <div className="mb-6 grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-400">Toplam Müşteri</p>
          <p className="mt-1 text-xl font-extrabold text-dark-900">{summary.total}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-400">Bu Ay Yeni</p>
          <p className="mt-1 text-xl font-extrabold text-dark-900">{summary.newThisMonth}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-400">Bu Ay Tekrar</p>
          <p className="mt-1 text-xl font-extrabold text-dark-900">{summary.repeatThisMonth}</p>
        </div>
      </div>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="İsim veya telefon ara..."
        className="mb-3 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {SEGMENTS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSegment(s.id)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-semibold",
              segment === s.id
                ? "bg-primary text-white"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm text-slate-500">
            {customers.length === 0 ? "Henüz müşteri kaydı yok." : "Bu filtreyle eşleşen müşteri yok."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <Link
              key={c.id}
              href={`/panel/musteriler/${c.id}`}
              className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 hover:shadow-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-bold text-dark-900">{c.full_name || "İsimsiz"}</p>
                <p className="text-xs text-slate-400">{c.phone}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold text-dark-900">{c.visit_count} ziyaret</p>
                <p className="text-xs text-slate-400">Son: {formatDate(c.last_visit_at)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
