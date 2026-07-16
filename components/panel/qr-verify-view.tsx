"use client";

import { useState, useTransition } from "react";
import { verifyCodeAction, type VerifyResult } from "@/lib/verification/actions";
import QrScanner from "@/components/panel/qr-scanner";
import { Stamp } from "@/components/ui/stamp";
import type { VerificationLogItem } from "@/lib/verification/queries";

const CODE_TYPE_LABEL: Record<string, string> = {
  package: "Paket Hakkı",
  flash: "Flaş Ayırtması",
  ticket: "Etkinlik Bileti",
  unknown: "Bilinmeyen Kod",
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

function ResultScreen({ result, onClose }: { result: VerifyResult; onClose: () => void }) {
  if (result.success) {
    let title = "Doğrulandı";
    let subtitle = result.detail ?? "";

    if (result.code_type === "package" && result.data) {
      title = "1 hak kullanıldı";
      subtitle = `kalan ${result.data.remaining_uses} / ${result.data.usage_count}`;
    } else if (result.code_type === "flash") {
      title = "Ayırtma onaylandı";
    } else if (result.code_type === "ticket") {
      title = "Giriş onaylandı";
    }

    return (
      <div className="flex flex-col items-center justify-center rounded-xl bg-primary-600 px-6 py-10 text-center text-white">
        <div className="stamp mb-4 flex h-16 w-16 items-center justify-center border-white/60 text-3xl">
          ✓
        </div>
        {result.customer_name && (
          <p className="text-sm font-medium text-white/80">{result.customer_name}</p>
        )}
        <p className="mt-1 font-sans text-2xl font-bold tabular-nums">{result.detail}</p>
        <p className="mt-2 text-lg font-bold text-white/90">{title}</p>
        {subtitle && result.code_type === "package" && (
          <p className="text-sm text-white/80">{subtitle}</p>
        )}
        <button
          onClick={onClose}
          className="mt-8 w-full max-w-xs rounded-md bg-white px-4 py-3 text-sm font-bold text-primary-700"
        >
          Tamam
        </button>
      </div>
    );
  }

  const ERROR_LABEL: Record<string, string> = {
    WRONG_BUSINESS: "Bu kod sizin işletmenize ait değil",
    NO_USES_LEFT: "Bu kodda kullanılabilir hak kalmamış",
    EXPIRED: "Paketin süresi dolmuş",
    ALREADY_USED: result.message ?? "Bu kod zaten kullanılmış",
    CANCELLED: "Bu bilet iptal edilmiş",
    INVALID_CODE: "Geçersiz kod",
  };

  return (
    <div className="flex flex-col items-center justify-center rounded-xl bg-tile-500 px-6 py-10 text-center text-white">
      <div className="stamp mb-4 flex h-16 w-16 items-center justify-center border-white/60 text-3xl">
        ✕
      </div>
      {result.customer_name && (
        <p className="text-sm font-medium text-white/80">{result.customer_name}</p>
      )}
      {result.detail && <p className="mt-1 text-lg font-bold">{result.detail}</p>}
      <p className="mt-2 text-base font-semibold text-white/95">
        {ERROR_LABEL[result.error_code ?? ""] ?? result.message ?? "Doğrulanamadı"}
      </p>
      <button
        onClick={onClose}
        className="mt-8 w-full max-w-xs rounded-md bg-white px-4 py-3 text-sm font-bold text-tile-700"
      >
        Tamam
      </button>
    </div>
  );
}

export default function QrVerifyView({ initialHistory }: { initialHistory: VerificationLogItem[] }) {
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState(initialHistory);
  const [isPending, startTransition] = useTransition();

  function runVerify(code: string) {
    if (isPending || result) return;
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("code", code);
      const res = await verifyCodeAction(formData);
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.result) {
        setResult(res.result);
        setHistory((prev) => [
          {
            id: crypto.randomUUID(),
            code,
            code_type: res.result!.code_type,
            result: res.result!.success ? "success" : "error",
            error_code: res.result!.error_code ?? null,
            customer_name: res.result!.customer_name ?? null,
            detail: res.result!.detail ?? null,
            created_at: new Date().toISOString(),
          },
          ...prev,
        ]);
      }
    });
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!manualCode.trim()) return;
    runVerify(manualCode.trim());
  }

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <h1 className="mb-4 text-center font-display text-xl font-medium tracking-tight text-ink-900">
        QR Doğrula
      </h1>

      {result ? (
        <ResultScreen
          result={result}
          onClose={() => {
            setResult(null);
            setManualCode("");
          }}
        />
      ) : (
        <>
          <QrScanner onScan={runVerify} paused={isPending} />

          {error && (
            <p className="mt-3 rounded-md bg-tile-50 px-3 py-2 text-center text-sm text-tile-600">
              {error}
            </p>
          )}

          <form onSubmit={handleManualSubmit} className="mt-4 flex gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.toUpperCase())}
              placeholder="Kodu elle gir (LCL / FLA / TKT)"
              className="w-full rounded-md border border-border bg-card px-4 py-3 text-sm uppercase tracking-wide focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              disabled={isPending}
              className="shrink-0 rounded-md bg-ink-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              Doğrula
            </button>
          </form>
        </>
      )}

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-bold text-ink-900">Bugünün Geçmişi</h2>
        {history.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Henüz doğrulama yapılmadı.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {history.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink-900">
                    {item.detail || item.customer_name || item.code}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {CODE_TYPE_LABEL[item.code_type] ?? item.code_type} · {formatTime(item.created_at)}
                  </p>
                </div>
                <Stamp
                  label={item.result === "success" ? "Başarılı" : "Hata"}
                  tone={item.result === "success" ? "primary" : "brick"}
                  className="shrink-0 px-2.5 py-0.5 text-[10px]"
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
