"use client";

import { useState, useTransition } from "react";
import { CalendarCheck } from "lucide-react";
import { cancelReservationAction } from "@/lib/purchases/actions";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import type { PendingReservation } from "@/lib/purchases/queries";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("tr-TR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTL(n: number) {
  return n.toLocaleString("tr-TR") + "₺";
}

function ReservationRow({ reservation }: { reservation: PendingReservation }) {
  const [error, setError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleCancel() {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("purchaseId", reservation.id);
      const result = await cancelReservationAction(formData);
      if (result?.error) setError(result.error);
      else setCancelled(true);
    });
  }

  if (cancelled) return null;

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="truncate font-bold text-foreground">{reservation.customerName}</p>
          <p className="text-xs text-muted-foreground">
            {reservation.customerPhone ?? "Telefon yok"}
          </p>
          <p className="mt-1 text-sm text-foreground">{reservation.packageTitle}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatDateTime(reservation.createdAt)} tarihinde ayırdı ·{" "}
            {formatTL(reservation.amount)}
          </p>
          {error && <p className="mt-1 text-xs font-medium text-danger-700">{error}</p>}
        </div>
        <div className="shrink-0 text-right">
          <span className="mb-2 inline-block rounded-full bg-discount-50 px-2.5 py-0.5 text-xs font-semibold text-discount-700">
            Henüz gelmedi
          </span>
          {confirming ? (
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="danger"
                size="sm"
                disabled={isPending}
                onClick={handleCancel}
              >
                {isPending ? "..." : "Onayla"}
              </Button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="text-xs font-medium text-muted-foreground"
              >
                Vazgeç
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="block text-xs font-semibold text-danger-700 underline underline-offset-2"
            >
              Rezervasyonu iptal et
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ReservationsView({
  reservations,
}: {
  reservations: PendingReservation[];
}) {
  if (reservations.length === 0) {
    return (
      <EmptyState
        icon={CalendarCheck}
        title="Bekleyen rezervasyon yok"
        description="Müşteriler paket ayırttığında burada görünecek — ödemeyi ilk ziyarette mekânda alırsın."
      />
    );
  }

  return (
    <div className="space-y-3">
      {reservations.map((r) => (
        <ReservationRow key={r.id} reservation={r} />
      ))}
    </div>
  );
}
