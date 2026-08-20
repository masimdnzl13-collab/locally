"use client";

import { useState, useTransition } from "react";
import { runSimulationAction, type SimulationKind } from "@/lib/test-lab/actions";
import { Button } from "@/components/ui/button";

const ACTIONS: { kind: SimulationKind; label: string; variant: "outline" | "danger" }[] = [
  { kind: "admin_test_new_reservation", label: "Yeni bir rezervasyon üret", variant: "outline" },
  { kind: "admin_test_expire_package", label: "Bir paketin süresini dolmuş yap", variant: "danger" },
  { kind: "admin_test_fill_flash_quota", label: "Bir flaşın kontenjanını doldur", variant: "danger" },
  { kind: "admin_test_end_flash", label: "Bir flaşı bitir", variant: "danger" },
  { kind: "admin_test_add_historical_verification", label: "Geçmişe dönük doğrulama kaydı ekle", variant: "outline" },
  { kind: "admin_test_set_business_pending", label: "Test İşletmesini onay bekler yap", variant: "danger" },
];

export default function SimulationPanel() {
  const [pendingKind, setPendingKind] = useState<SimulationKind | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(kind: SimulationKind, successText: string) {
    setMessage(null);
    setError(null);
    setPendingKind(kind);
    startTransition(async () => {
      const result = await runSimulationAction(kind);
      if (result.error) setError(result.error);
      else setMessage(successText);
      setPendingKind(null);
    });
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {ACTIONS.map((a) => (
          <Button
            key={a.kind}
            type="button"
            variant={a.variant}
            size="sm"
            disabled={isPending}
            onClick={() => run(a.kind, `"${a.label}" çalıştırıldı.`)}
          >
            {isPending && pendingKind === a.kind ? "..." : a.label}
          </Button>
        ))}
      </div>

      <div className="mt-3 border-t border-border pt-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isPending}
          onClick={() => run("admin_test_reset_lab_data", "Test Lab verileri ilk haline sıfırlandı.")}
        >
          {isPending && pendingKind === "admin_test_reset_lab_data"
            ? "..."
            : "↺ Test Lab verilerini sıfırla"}
        </Button>
      </div>

      {error && <p className="mt-3 text-sm font-medium text-danger-700">{error}</p>}
      {message && <p className="mt-3 text-sm font-medium text-success-700">{message}</p>}
    </div>
  );
}
