"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { adminApproveRefundAction, adminRejectRefundAction } from "@/lib/purchases/actions";
import type { PendingRefund } from "@/lib/admin/queries";

function formatTL(n: number) {
  return n.toLocaleString("tr-TR") + "₺";
}

export default function RefundReviewRow({ refund }: { refund: PendingRefund }) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "reject">("idle");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function approve() {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("purchaseId", refund.purchaseId);
      const result = await adminApproveRefundAction(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function reject() {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("purchaseId", refund.purchaseId);
      formData.set("reason", reason);
      const result = await adminRejectRefundAction(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-ink-900">{refund.packageTitle}</p>
          <p className="text-xs text-muted-foreground">{refund.businessName}</p>
          <p className="text-xs text-muted-foreground">
            {refund.customerName ?? "İsimsiz"} · {refund.customerPhone ?? "—"}
          </p>
        </div>
        <span className="text-sm font-bold tabular-nums text-ink-900">{formatTL(refund.amount)}</span>
      </div>

      {error && <p className="mt-2 text-xs text-tile-600">{error}</p>}

      {mode === "idle" ? (
        <div className="mt-3 flex gap-2">
          <Button onClick={approve} disabled={isPending} shape="rect" size="sm">
            {isPending ? "İşleniyor..." : "Onayla ve İade Et"}
          </Button>
          <Button
            onClick={() => setMode("reject")}
            variant="outline"
            shape="rect"
            size="sm"
            className="border-tile-200 text-tile-600 hover:bg-tile-50"
          >
            Reddet
          </Button>
        </div>
      ) : (
        <div className="mt-3">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Red gerekçesi"
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="mt-2 flex gap-2">
            <Button
              onClick={reject}
              disabled={isPending}
              shape="rect"
              size="sm"
              className="bg-tile-600 text-white hover:bg-tile-700"
            >
              Reddi Onayla
            </Button>
            <Button onClick={() => setMode("idle")} variant="outline" shape="rect" size="sm">
              Vazgeç
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
