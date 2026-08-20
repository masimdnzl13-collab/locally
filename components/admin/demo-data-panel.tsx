"use client";

import { useState, useTransition } from "react";
import { loadDemoDataAction, clearDemoDataAction } from "@/lib/admin/demo-actions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { DemoDataSummary } from "@/lib/admin/demo-actions";

export default function DemoDataPanel({ summary }: { summary: DemoDataSummary }) {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleLoad() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await loadDemoDataAction();
      if (result?.error) setError(result.error);
      else setMessage("Demo verisi yüklendi. Sayfayı yenileyince yeni sayılar görünür.");
    });
  }

  function handleClear() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await clearDemoDataAction();
      if (result?.error) setError(result.error);
      else setMessage("Demo verisi temizlendi. Gerçek kayıtlara dokunulmadı.");
    });
  }

  return (
    <Card className="mt-8">
      <CardContent className="p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Demo Veri Seti
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {summary.loaded
            ? `Yüklü: ${summary.businesses} işletme, ${summary.users} kullanıcı, ${summary.packages} paket, ${summary.purchases} satın alma/rezervasyon.`
            : "Şu an demo veri yüklü değil."}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="teal" size="sm" disabled={isPending} onClick={handleLoad}>
            {isPending ? "..." : "Demo Verisini Yükle"}
          </Button>
          <Button type="button" variant="danger" size="sm" disabled={isPending} onClick={handleClear}>
            {isPending ? "..." : "Demo Verisini Temizle"}
          </Button>
        </div>

        {error && <p className="mt-3 text-sm font-medium text-danger-700">{error}</p>}
        {message && <p className="mt-3 text-sm font-medium text-success-700">{message}</p>}

        <p className="mt-3 text-xs text-muted-foreground">
          Yalnızca is_demo işaretli kayıtları oluşturur/siler. Gerçek işletme ve
          kullanıcı verilerine asla dokunmaz.
        </p>
      </CardContent>
    </Card>
  );
}
