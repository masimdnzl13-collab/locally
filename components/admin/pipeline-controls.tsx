"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import {
  createSalesLeadAction,
  deleteSalesLeadAction,
  linkSalesLeadAction,
  updateSalesLeadStatusAction,
} from "@/lib/admin/pipeline-actions";
import {
  SALES_LEAD_STATUSES,
  SALES_LEAD_STATUS_LABELS,
  type SalesLeadStatus,
} from "@/lib/admin/pipeline-constants";
import { Input } from "@/components/ui/input";
import SubmitButton from "@/components/ui/submit-button";

type Action = (fd: FormData) => Promise<{ error?: string; success?: true }>;

function useAction() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const run = (action: Action, fields: Record<string, string> | FormData, onDone?: () => void) => {
    setError(null);
    startTransition(async () => {
      const fd = fields instanceof FormData ? fields : new FormData();
      if (!(fields instanceof FormData)) Object.entries(fields).forEach(([k, v]) => fd.set(k, v));
      const result = await action(fd);
      if (result?.error) return setError(result.error);
      onDone?.();
      router.refresh();
    });
  };
  return { run, error, isPending };
}

const selectClass =
  "h-9 rounded-md border border-border bg-card px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50";

export function NewLeadForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const { run, error, isPending } = useAction();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form
      ref={formRef}
      action={(fd) => run(createSalesLeadAction, fd, () => formRef.current?.reset())}
      className="grid gap-3 rounded-lg border border-border bg-card p-4 shadow-card sm:grid-cols-2 lg:grid-cols-6"
    >
      <div className="lg:col-span-2">
        <label className="mb-1 block text-xs font-medium text-muted-foreground">İşletme adı</label>
        <Input name="businessName" required maxLength={120} placeholder="Örn. Luigi's Pizza" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Şehir</label>
        <Input name="city" maxLength={80} placeholder="Örn. Wildwood" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Ziyaret tarihi</label>
        <Input name="visitedOn" type="date" defaultValue={today} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Durum</label>
        <select name="status" defaultValue="tanitildi" className={`${selectClass} w-full`}>
          {SALES_LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {SALES_LEAD_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">İletişim / not</label>
        <Input name="contact" maxLength={160} placeholder="Tel, e-posta, isim" />
      </div>
      <div className="flex items-end gap-3 sm:col-span-2 lg:col-span-6">
        <SubmitButton pending={isPending} className="w-auto px-6">
          Aday ekle
        </SubmitButton>
        {error && <p className="text-sm text-danger-600">{error}</p>}
      </div>
    </form>
  );
}

export function LeadRowControls({
  leadId,
  status,
  linkable,
}: {
  leadId: string;
  status: SalesLeadStatus;
  linkable: { id: string; name: string }[];
}) {
  const { run, error, isPending } = useAction();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Durum"
        value={status}
        disabled={isPending}
        onChange={(e) => run(updateSalesLeadStatusAction, { leadId, status: e.target.value })}
        className={selectClass}
      >
        {SALES_LEAD_STATUSES.map((s) => (
          <option key={s} value={s}>
            {SALES_LEAD_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      {status === "kaydoldu" && linkable.length > 0 && (
        <select
          aria-label="Kayıtlı işletmeye bağla"
          defaultValue=""
          disabled={isPending}
          onChange={(e) => e.target.value && run(linkSalesLeadAction, { leadId, businessId: e.target.value })}
          className={selectClass}
        >
          <option value="">İşletmeye bağla…</option>
          {linkable.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      )}
      <button
        type="button"
        aria-label="Adayı sil"
        disabled={isPending}
        onClick={() => run(deleteSalesLeadAction, { leadId })}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-danger-50 hover:text-danger-600 disabled:opacity-50"
      >
        <Trash2 className="h-4 w-4" />
      </button>
      {error && <p className="w-full text-xs text-danger-600">{error}</p>}
    </div>
  );
}
