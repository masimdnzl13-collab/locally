"use client";

import { useState } from "react";
import { Ticket as TicketIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { TicketCard } from "@/components/ui/ticket-card";
import { Stamp } from "@/components/ui/stamp";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedControl } from "@/components/ui/segmented-control";

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
      <h1 className="mb-6 font-display text-2xl font-medium tracking-tight text-foreground">
        Biletlerim
      </h1>

      <SegmentedControl
        layoutId="my-tickets-tab"
        className="mb-6 w-fit"
        options={[
          { value: "active", label: `Yaklaşan (${active.length})` },
          { value: "finished", label: `Geçmiş (${finished.length})` },
        ]}
        value={tab}
        onChange={setTab}
      />

      {shown.length === 0 ? (
        <EmptyState
          icon={TicketIcon}
          title={tab === "active" ? "Henüz bir etkinliğe kaydın yok" : "Henüz geçmiş bir etkinliğin yok"}
          description={
            tab === "active" ? "Etkinlikler'den göz atabilirsin." : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          {shown.map((item) => (
            <div key={item.id} className="relative">
              <button
                onClick={() => setSelected(item)}
                className={cn(
                  "block w-full text-left transition-transform duration-200 hover:-translate-y-0.5",
                  item.finished && "opacity-70"
                )}
              >
                <TicketCard
                  bodyClassName="flex items-center gap-4 p-4"
                  stubClassName="justify-between"
                  stub={
                    <>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(item.eventAt)}
                      </span>
                      <span className="text-xs font-semibold text-foreground">
                        {item.priceLabel}
                      </span>
                    </>
                  }
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                    <TicketIcon size={22} strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-muted-foreground">{item.businessName}</p>
                    <p className="truncate font-semibold text-foreground">{item.eventTitle}</p>
                    {item.statusLabel && (
                      <p className="mt-1 text-xs font-semibold text-tile-600">{item.statusLabel}</p>
                    )}
                  </div>
                </TicketCard>
              </button>
              {item.finished && (
                <Stamp
                  label="Tamamlandı"
                  tone="ink"
                  className="pointer-events-none absolute -top-3 right-5 text-[10px]"
                />
              )}
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-ink-950/90 px-6"
          onClick={() => setSelected(null)}
        >
          <div className="w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
            <TicketCard
              notchBg="6 32 40"
              bodyClassName="p-6 text-center"
              stub={
                <span className="mx-auto text-xs uppercase tracking-wide text-muted-foreground">
                  {selected.priceLabel}
                </span>
              }
            >
              <p className="text-sm text-muted-foreground">{selected.businessName}</p>
              <p className="mb-4 font-semibold text-foreground">{selected.eventTitle}</p>
              {selected.statusLabel && (
                <Stamp label="İptal Edildi" tone="brick" className="mb-4" />
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selected.qrDataUrl} alt="Bilet QR kodu" className="mx-auto h-56 w-56" />
              <p className="mt-3 text-sm font-semibold tracking-widest text-ink-900">
                {selected.qrCode}
              </p>
              {selected.statusLabel && (
                <p className="mt-2 text-xs text-tile-600">{selected.statusLabel}</p>
              )}
            </TicketCard>
          </div>
          <button
            onClick={() => setSelected(null)}
            className="mt-6 text-sm font-medium text-sand-50/70 hover:text-sand-50"
          >
            Kapat
          </button>
        </div>
      )}
    </div>
  );
}
