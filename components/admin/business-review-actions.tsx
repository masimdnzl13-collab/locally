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
        <p className="rounded-md border border-tile-200 bg-tile-50 px-3 py-2 text-sm text-tile-600">
          {error}
        </p>
      )}

      {mode === "idle" && (
        <div className="flex flex-wrap gap-2">
          {status === "pending" && (
            <>
              <Button onClick={() => run(approveBusinessAction)} disabled={isPending} shape="rect" size="sm">
                Onayla
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
            </>
          )}
          {status === "approved" && (
            <Button
              onClick={() => setMode("suspend")}
              variant="outline"
              shape="rect"
              size="sm"
              className="border-tile-200 text-tile-600 hover:bg-tile-50"
            >
              Askıya Al
            </Button>
          )}
          {status === "suspended" && (
            <Button onClick={() => run(reactivateBusinessAction)} disabled={isPending} shape="rect" size="sm">
              Askıyı Kaldır
            </Button>
          )}
          {status === "rejected" && (
            <Button onClick={() => run(approveBusinessAction)} disabled={isPending} shape="rect" size="sm">
              Onayla
            </Button>
          )}
        </div>
      )}

      {(mode === "reject" || mode === "suspend") && (
        <div className="rounded-xl border border-border bg-card p-4">
          <label className="mb-1.5 block text-sm font-medium text-ink-900">
            {mode === "reject" ? "Red gerekçesi" : "Askıya alma gerekçesi"}
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="mt-3 flex gap-2">
            <Button
              onClick={() =>
                run(mode === "reject" ? rejectBusinessAction : suspendBusinessAction, { reason })
              }
              disabled={isPending || (mode === "reject" && !reason.trim())}
              shape="rect"
              size="sm"
              className="bg-tile-600 text-white hover:bg-tile-700"
            >
              {isPending ? "İşleniyor..." : "Onayla"}
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
