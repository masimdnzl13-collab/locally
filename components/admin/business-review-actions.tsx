"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  approveBusinessAction,
  rejectBusinessAction,
  suspendBusinessAction,
  reactivateBusinessAction,
} from "@/lib/admin/actions";
import { Button } from "@/components/ui/button";
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
      {error && (
        <p className="rounded-md border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700">
          {error}
        </p>
      )}

      {mode === "idle" && (
        <div className="flex flex-wrap gap-2">
          {status === "pending" && (
            <>
              <Button onClick={() => run(approveBusinessAction)} disabled={isPending} variant="teal" size="sm">
                Onayla
              </Button>
              <Button
                onClick={() => setMode("reject")}
                variant="danger"
                size="sm"
              >
                Reddet
              </Button>
            </>
          )}
          {status === "approved" && (
            <Button
              onClick={() => setMode("suspend")}
              variant="danger"
              size="sm"
            >
              Askıya Al
            </Button>
          )}
          {status === "suspended" && (
            <Button onClick={() => run(reactivateBusinessAction)} disabled={isPending} variant="teal" size="sm">
              Askıyı Kaldır
            </Button>
          )}
          {status === "rejected" && (
            <Button onClick={() => run(approveBusinessAction)} disabled={isPending} variant="teal" size="sm">
              Onayla
            </Button>
          )}
        </div>
      )}

      {(mode === "reject" || mode === "suspend") && (
        <div className="rounded-lg border border-border bg-card p-4 shadow-card">
          <label className="mb-1.5 block text-sm font-medium text-navy-900">
            {mode === "reject" ? "Red gerekçesi" : "Askıya alma gerekçesi"}
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            className="w-full rounded-input border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="mt-3 flex gap-2">
            <Button
              onClick={() =>
                run(mode === "reject" ? rejectBusinessAction : suspendBusinessAction, { reason })
              }
              disabled={isPending || (mode === "reject" && !reason.trim())}
              variant="danger"
              size="sm"
            >
              {isPending ? "İşleniyor..." : "Onayla"}
            </Button>
            <Button onClick={() => setMode("idle")} variant="outline" size="sm">
              Vazgeç
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
