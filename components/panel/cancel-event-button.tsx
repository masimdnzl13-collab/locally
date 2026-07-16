"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelEventAction } from "@/lib/events/actions";

export default function CancelEventButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCancel() {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("eventId", eventId);
      const result = await cancelEventAction(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
      setConfirming(false);
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-md border border-danger-200 px-4 py-2.5 text-sm font-semibold text-danger-600 transition-colors hover:bg-danger-50"
      >
        Etkinliği İptal Et
      </button>
    );
  }

  return (
    <div className="rounded-md border border-danger-200 bg-danger-50 p-4">
      <p className="text-sm font-semibold text-danger-700">
        Emin misin? Katılımcılara iptal bilgisi yansıyacak, biletli kayıtlarda iade süreci
        başlatılacak.
      </p>
      {error && <p className="mt-2 text-sm text-danger-600">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={handleCancel}
          disabled={isPending}
          className="rounded-md bg-danger-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-danger-700 disabled:opacity-60"
        >
          {isPending ? "İptal ediliyor..." : "Evet, İptal Et"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted"
        >
          Vazgeç
        </button>
      </div>
    </div>
  );
}
