"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  approveBusinessAction,
  rejectBusinessAction,
  suspendBusinessAction,
  reactivateBusinessAction,
} from "@/lib/admin/actions";
import type { ApprovalStatus } from "@/lib/types";

export default function BusinessReviewActions({
  businessId,
  status,
}: {
  businessId: string;
  status: ApprovalStatus;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "reject" | "suspend">("idle");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(action: (fd: FormData) => Promise<{ error?: string; success?: true }>, extra?: Record<string, string>) {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("businessId", businessId);
      Object.entries(extra ?? {}).forEach(([k, v]) => formData.set(k, v));
      const result = await action(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setMode("idle");
      setReason("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {mode === "idle" && (
        <div className="flex flex-wrap gap-2">
          {status === "pending" && (
            <>
              <button
                onClick={() => run(approveBusinessAction)}
                disabled={isPending}
                className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                Onayla
              </button>
              <button
                onClick={() => setMode("reject")}
                className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
              >
                Reddet
              </button>
            </>
          )}
          {status === "approved" && (
            <button
              onClick={() => setMode("suspend")}
              className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
            >
              Askıya Al
            </button>
          )}
          {status === "suspended" && (
            <button
              onClick={() => run(reactivateBusinessAction)}
              disabled={isPending}
              className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              Askıyı Kaldır
            </button>
          )}
          {status === "rejected" && (
            <button
              onClick={() => run(approveBusinessAction)}
              disabled={isPending}
              className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              Onayla
            </button>
          )}
        </div>
      )}

      {(mode === "reject" || mode === "suspend") && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <label className="mb-1.5 block text-sm font-medium text-dark-900">
            {mode === "reject" ? "Red gerekçesi" : "Askıya alma gerekçesi"}
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
          <div className="mt-3 flex gap-2">
            <button
              onClick={() =>
                run(mode === "reject" ? rejectBusinessAction : suspendBusinessAction, { reason })
              }
              disabled={isPending || (mode === "reject" && !reason.trim())}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {isPending ? "İşleniyor..." : "Onayla"}
            </button>
            <button
              onClick={() => setMode("idle")}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
            >
              Vazgeç
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
