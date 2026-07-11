"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-dark-900">{refund.packageTitle}</p>
          <p className="text-xs text-slate-500">{refund.businessName}</p>
          <p className="text-xs text-slate-400">
            {refund.customerName ?? "İsimsiz"} · {refund.customerPhone ?? "—"}
          </p>
        </div>
        <span className="text-sm font-bold text-dark-900">{formatTL(refund.amount)}</span>
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {mode === "idle" ? (
        <div className="mt-3 flex gap-2">
          <button
            onClick={approve}
            disabled={isPending}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
          >
            {isPending ? "İşleniyor..." : "Onayla ve İade Et"}
          </button>
          <button
            onClick={() => setMode("reject")}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600"
          >
            Reddet
          </button>
        </div>
      ) : (
        <div className="mt-3">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Red gerekçesi"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-primary focus:outline-none"
          />
          <div className="mt-2 flex gap-2">
            <button
              onClick={reject}
              disabled={isPending}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
            >
              Reddi Onayla
            </button>
            <button
              onClick={() => setMode("idle")}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600"
            >
              Vazgeç
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
