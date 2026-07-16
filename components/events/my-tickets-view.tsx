"use client";

import { useState } from "react";
import { Ticket as TicketIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-foreground">
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
            <button
              key={item.id}
              onClick={() => setSelected(item)}
              className="block w-full text-left"
            >
              <Card
                hoverLift
                className={cn("flex items-center gap-4 p-4", item.finished && "opacity-70")}
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                  <TicketIcon size={22} strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-muted-foreground">{item.businessName}</p>
                  <p className="truncate font-semibold text-foreground">{item.eventTitle}</p>
                  {item.statusLabel && (
                    <p className="mt-1 text-xs font-semibold text-danger-600">{item.statusLabel}</p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-muted-foreground">{formatDateTime(item.eventAt)}</p>
                  <p className="text-xs font-semibold text-foreground">{item.priceLabel}</p>
                  {item.finished && !item.statusLabel && (
                    <Badge variant="success" className="mt-1.5">
                      Tamamlandı
                    </Badge>
                  )}
                </div>
              </Card>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-navy-950/90 px-6"
          onClick={() => setSelected(null)}
        >
          <Card
            className="w-full max-w-xs p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm text-muted-foreground">{selected.businessName}</p>
            <p className="mb-4 font-semibold text-foreground">{selected.eventTitle}</p>
            {selected.statusLabel && (
              <Badge variant="danger" className="mb-4">
                İptal Edildi
              </Badge>
            )}

            <div className="mx-auto flex h-56 w-56 items-center justify-center rounded-lg bg-muted p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selected.qrDataUrl} alt="Bilet QR kodu" className="h-full w-full" />
            </div>
            <p className="mt-3 text-sm font-semibold tracking-widest text-navy-900">
              {selected.qrCode}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">{selected.priceLabel}</p>
            {selected.statusLabel && (
              <p className="mt-2 text-xs text-danger-700">{selected.statusLabel}</p>
            )}
          </Card>
          <button
            onClick={() => setSelected(null)}
            className="mt-6 text-sm font-medium text-white/70 hover:text-white"
          >
            Kapat
          </button>
        </div>
      )}
    </div>
  );
}
