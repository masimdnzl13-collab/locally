"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePrivacyRequestAction } from "@/lib/privacy/admin-actions";
import { PRIVACY_STATUS_LABELS, type PrivacyRequestStatus } from "@/lib/privacy/constants";

export default function PrivacyRequestControls({
  requestId,
  status,
  adminNote,
}: {
  requestId: string;
  status: PrivacyRequestStatus;
  adminNote: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      action={(fd) => {
        setError(null);
        fd.set("requestId", requestId);
        startTransition(async () => {
          const result = await updatePrivacyRequestAction(fd);
          if (result.error) setError(result.error);
          else router.refresh();
        });
      }}
      className="flex flex-col gap-2 sm:flex-row sm:items-start"
    >
      <select
        name="status"
        defaultValue={status}
        disabled={isPending}
        className="h-9 rounded-md border border-border bg-card px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-teal-500"
      >
        {Object.entries(PRIVACY_STATUS_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <input
        name="adminNote"
        defaultValue={adminNote ?? ""}
        maxLength={2000}
        placeholder="İç not (ör. kimlik doğrulandı, Tideline'dan silindi)"
        className="h-9 flex-1 rounded-md border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-teal-500"
      />
      <button
        type="submit"
        disabled={isPending}
        className="h-9 rounded-md bg-navy-900 px-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {isPending ? "…" : "Kaydet"}
      </button>
      {error && <p className="text-xs text-danger-600">{error}</p>}
    </form>
  );
}
