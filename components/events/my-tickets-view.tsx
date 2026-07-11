"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface MyTicketCard {
  id: string;
  businessName: string;
  eventTitle: string;
  eventAt: string;
  priceLabel: string;
  qrDataUrl: string;
  qrCode: string;
  finished: boolean;
  statusLabel?: string | null;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("tr-TR", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MyTicketsView({ items }: { items: MyTicketCard[] }) {
  const [tab, setTab] = useState<"active" | "finished">("active");
  const [selected, setSelected] = useState<MyTicketCard | null>(null);

  const active = items.filter((i) => !i.finished);
  const finished = items.filter((i) => i.finished);
  const shown = tab === "active" ? active : finished;

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="mb-6 text-2xl font-extrabold tracking-tight text-dark-900">
        Biletlerim
      </h1>

      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setTab("active")}
          className={cn(
            "rounded-full px-4 py-2 text-sm font-semibold",
            tab === "active" ? "bg-primary text-white" : "bg-slate-100 text-slate-500"
          )}
        >
          Yaklaşan ({active.length})
        </button>
        <button
          onClick={() => setTab("finished")}
          className={cn(
            "rounded-full px-4 py-2 text-sm font-semibold",
            tab === "finished" ? "bg-primary text-white" : "bg-slate-100 text-slate-500"
          )}
        >
          Geçmiş ({finished.length})
        </button>
      </div>

      {shown.length === 0 ? (
        <p className="py-16 text-center text-sm text-slate-500">
          {tab === "active"
            ? "Henüz bir etkinliğe kaydın yok. Etkinlikler'den göz atabilirsin."
            : "Henüz geçmiş bir etkinliğin yok."}
        </p>
      ) : (
        <div className="space-y-3">
          {shown.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelected(item)}
              className={cn(
                "flex w-full items-center gap-4 rounded-2xl border border-slate-200 p-4 text-left transition-opacity",
                item.finished && "opacity-50"
              )}
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-2xl">
                🎫
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-slate-500">{item.businessName}</p>
                <p className="truncate font-bold text-dark-900">{item.eventTitle}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {formatDateTime(item.eventAt)} · {item.priceLabel}
                </p>
                {item.statusLabel && (
                  <p className="mt-1 text-xs font-semibold text-red-600">{item.statusLabel}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-dark-950/95 px-6"
          onClick={() => setSelected(null)}
        >
          <div className="w-full max-w-xs rounded-3xl bg-white p-6 text-center">
            <p className="text-sm text-slate-500">{selected.businessName}</p>
            <p className="mb-4 font-bold text-dark-900">{selected.eventTitle}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selected.qrDataUrl} alt="Bilet QR kodu" className="mx-auto h-64 w-64" />
            <p className="mt-3 text-sm font-semibold tracking-widest text-dark-900">
              {selected.qrCode}
            </p>
          </div>
          <button
            onClick={() => setSelected(null)}
            className="mt-6 text-sm font-medium text-white/70"
          >
            Kapat
          </button>
        </div>
      )}
    </div>
  );
}
