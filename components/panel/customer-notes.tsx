"use client";

import { useState, useTransition } from "react";
import { updateCustomerNotesAction } from "@/lib/customers/actions";

export default function CustomerNotes({
  customerId,
  initialNotes,
}: {
  customerId: string;
  initialNotes: string | null;
}) {
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    setSaved(false);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("customerId", customerId);
      formData.set("notes", notes);
      const result = await updateCustomerNotesAction(formData);
      if (!result?.error) setSaved(true);
    });
  }

  return (
    <div>
      <textarea
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value);
          setSaved(false);
        }}
        rows={3}
        placeholder="Bu müşteri için kısa bir not ekle..."
        className="w-full rounded-md border border-border bg-card px-4 py-3 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="rounded-md bg-ink-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-ink-800 disabled:opacity-60"
        >
          {isPending ? "Kaydediliyor..." : "Notu Kaydet"}
        </button>
        {saved && <span className="text-xs font-medium text-primary-600">✓ Kaydedildi</span>}
      </div>
    </div>
  );
}
