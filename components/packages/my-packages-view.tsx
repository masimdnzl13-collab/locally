"use client";

import { useState } from "react";
import { Ticket } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-foreground">
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
                  <Ticket size={22} strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-muted-foreground">{item.businessName}</p>
                  <p className="truncate font-semibold text-foreground">{item.title}</p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    {Array.from({ length: item.totalUses }).map((_, i) => (
                      <span
                        key={i}
                        className={cn(
                          "h-1.5 w-4 rounded-full",
                          i < item.remainingUses ? "bg-teal-500" : "bg-stone-200"
                        )}
                      />
                    ))}
                    <span className="ml-1 text-xs text-muted-foreground">
                      {item.remainingUses}/{item.totalUses}
                    </span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-muted-foreground">{formatDate(item.expiresAt)}</p>
                  {item.finished && (
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
            <p className="mb-4 font-semibold text-foreground">{selected.title}</p>
            {selected.finished && <Badge variant="success">Tamamlandı</Badge>}

            <div className="mx-auto mt-4 flex h-56 w-56 items-center justify-center rounded-lg bg-muted p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selected.qrDataUrl} alt="QR kod" className="h-full w-full" />
            </div>
            <p className="mt-3 text-sm font-semibold tracking-widest text-navy-900">
              {selected.qrCode}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {selected.remainingUses}/{selected.totalUses} hak kaldı
            </p>

            {selected.refundRequested ? (
              <Badge variant="neutral" className="mt-3">
                İnceleniyor
              </Badge>
            ) : selected.refundRejectReason ? (
              <>
                <Badge variant="danger" className="mt-3">
                  Reddedildi
                </Badge>
                <p className="mt-2 text-xs text-danger-700">
                  İade reddedildi: {selected.refundRejectReason}
                </p>
              </>
            ) : (
              selected.refundEligible && (
                <RefundRequestButton purchaseId={selected.purchaseId} />
              )
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
