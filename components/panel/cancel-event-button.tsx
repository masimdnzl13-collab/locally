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
        className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
      >
        Etkinliği İptal Et
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4">
      <p className="text-sm font-semibold text-red-700">
        Emin misin? Katılımcılara iptal bilgisi yansıyacak, biletli kayıtlarda iade süreci
        başlatılacak.
      </p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={handleCancel}
          disabled={isPending}
          className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {isPending ? "İptal ediliyor..." : "Evet, İptal Et"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
        >
          Vazgeç
        </button>
      </div>
    </div>
  );
}
