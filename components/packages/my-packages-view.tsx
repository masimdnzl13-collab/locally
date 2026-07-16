"use client";

import { useState } from "react";
import { Ticket } from "lucide-react";
import { cn } from "@/lib/utils";
import { TicketCard } from "@/components/ui/ticket-card";
import { Stamp } from "@/components/ui/stamp";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedControl } from "@/components/ui/segmented-control";
import RefundRequestButton from "@/components/packages/refund-request-button";

export interface MyPackageCard {
  id: string;
  businessName: string;
  title: string;
  remainingUses: number;
  totalUses: number;
  expiresAt: string;
  qrDataUrl: string;
  qrCode: string;
  finished: boolean;
  purchaseId: string;
  refundEligible: boolean;
  refundRequested: boolean;
  refundRejectReason: string | null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function MyPackagesView({ items }: { items: MyPackageCard[] }) {
  const [tab, setTab] = useState<"active" | "finished">("active");
  const [selected, setSelected] = useState<MyPackageCard | null>(null);

  const active = items.filter((i) => !i.finished);
  const finished = items.filter((i) => i.finished);
  const shown = tab === "active" ? active : finished;

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="mb-6 font-display text-2xl font-medium tracking-tight text-foreground">
        Paketlerim
      </h1>

      <SegmentedControl
        layoutId="my-packages-tab"
        className="mb-6 w-fit"
        options={[
          { value: "active", label: `Aktif (${active.length})` },
          { value: "finished", label: `Geçmiş (${finished.length})` },
        ]}
        value={tab}
        onChange={setTab}
      />

      {shown.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title={tab === "active" ? "Henüz aktif paketin yok" : "Henüz tamamlanmış paketin yok"}
          description={
            tab === "active" ? "Keşfet'ten bir paket alabilirsin." : undefined
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
                      <div className="flex items-center gap-1.5">
                        {Array.from({ length: item.totalUses }).map((_, i) => (
                          <span
                            key={i}
                            className={cn(
                              "h-1.5 w-4 rounded-full",
                              i < item.remainingUses ? "bg-primary" : "bg-sand-200"
                            )}
                          />
                        ))}
                        <span className="ml-1 text-xs text-muted-foreground">
                          {item.remainingUses}/{item.totalUses}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(item.expiresAt)}
                      </span>
                    </>
                  }
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                    <Ticket size={22} strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-muted-foreground">{item.businessName}</p>
                    <p className="truncate font-semibold text-foreground">{item.title}</p>
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
              stubClassName="justify-center gap-8"
              stub={
                <div className="text-center">
                  <p className="text-lg font-extrabold text-ink-900">
                    {selected.remainingUses}/{selected.totalUses}
                  </p>
                  <p className="text-xs text-muted-foreground">hak kaldı</p>
                </div>
              }
            >
              <p className="text-sm text-muted-foreground">{selected.businessName}</p>
              <p className="mb-4 font-semibold text-foreground">{selected.title}</p>
              {selected.finished && (
                <Stamp label="Tamamlandı" tone="ink" className="mb-4" />
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selected.qrDataUrl} alt="QR kod" className="mx-auto h-56 w-56" />
              <p className="mt-3 text-sm font-semibold tracking-widest text-ink-900">
                {selected.qrCode}
              </p>
              {selected.refundRequested ? (
                <Stamp label="İnceleniyor" tone="accent" className="mt-3" />
              ) : selected.refundRejectReason ? (
                <>
                  <Stamp label="Reddedildi" tone="brick" className="mt-3" />
                  <p className="mt-2 text-xs text-tile-600">
                    İade reddedildi: {selected.refundRejectReason}
                  </p>
                </>
              ) : (
                selected.refundEligible && (
                  <RefundRequestButton purchaseId={selected.purchaseId} />
                )
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
