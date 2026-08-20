"use client";

import { useState, useTransition } from "react";
import { Sparkles, Check, Copy, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import ToneSelector from "@/components/ai/tone-selector";
import { generatePackageCopyAction } from "@/lib/ai/actions";
import type { CampaignTone, PackageCopyResult } from "@/lib/ai/types";

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-800"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Kopyalandı" : "Kopyala"}
        </button>
      </div>
      <p className="whitespace-pre-wrap text-sm text-foreground">{value}</p>
    </div>
  );
}

export default function PackageCopyAssistant({
  getContent,
  getSalePrice,
  getReferencePrice,
  onApplyTitle,
  onApplyDescription,
}: {
  getContent: () => string;
  getSalePrice: () => number;
  getReferencePrice: () => number | null;
  onApplyTitle: (title: string) => void;
  onApplyDescription: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tone, setTone] = useState<CampaignTone>("samimi");
  const [result, setResult] = useState<PackageCopyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [titleApplied, setTitleApplied] = useState(false);
  const [descApplied, setDescApplied] = useState(false);

  function generate() {
    setError(null);
    setTitleApplied(false);
    setDescApplied(false);
    startTransition(async () => {
      const salePrice = getSalePrice();
      if (!salePrice || salePrice <= 0) {
        setError("Önce satış fiyatını gir, asistan gerçek fiyatı kullanır.");
        return;
      }
      const formData = new FormData();
      formData.set("content", getContent());
      formData.set("salePrice", String(salePrice));
      const referencePrice = getReferencePrice();
      if (referencePrice) formData.set("referencePrice", String(referencePrice));
      formData.set("tone", tone);

      const res = await generatePackageCopyAction(formData);
      if (res.error) {
        setError(res.error);
        return;
      }
      setResult(res.result ?? null);
    });
  }

  return (
    <div className="rounded-lg border border-teal-200 bg-teal-50/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setOpen((v) => !v);
              if (!open && !result) generate();
            }}
            className="flex items-center gap-1.5 rounded-md bg-teal-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-700"
          >
            <Sparkles className="h-4 w-4" />
            Benim İçin Yaz
          </button>
          <Badge variant="navy">Pro</Badge>
        </div>
        {open && <ToneSelector value={tone} onChange={setTone} />}
      </div>

      {open && (
        <div className="mt-4 space-y-3">
          {error && (
            <p className="rounded-md bg-danger-50 px-3 py-2 text-sm text-danger-600">{error}</p>
          )}

          {isPending && (
            <p className="animate-pulse text-sm text-muted-foreground">Asistan yazıyor...</p>
          )}

          {!isPending && result && (
            <>
              {result.demo && (
                <Badge variant="outline" className="text-xs">
                  Demo — örnek metin (ANTHROPIC_API_KEY tanımlı değil)
                </Badge>
              )}

              <div className="rounded-md border border-border bg-card p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Paket Başlığı
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onApplyTitle(result.title);
                      setTitleApplied(true);
                    }}
                    className="flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-800"
                  >
                    {titleApplied ? <Check className="h-3.5 w-3.5" /> : null}
                    {titleApplied ? "Uygulandı" : "Alana Aktar"}
                  </button>
                </div>
                <p className="text-sm text-foreground">{result.title}</p>
              </div>

              <div className="rounded-md border border-border bg-card p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Satış Metni
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onApplyDescription(result.salesCopy);
                      setDescApplied(true);
                    }}
                    className="flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-800"
                  >
                    {descApplied ? <Check className="h-3.5 w-3.5" /> : null}
                    {descApplied ? "Uygulandı" : "Alana Aktar"}
                  </button>
                </div>
                <p className="whitespace-pre-wrap text-sm text-foreground">{result.salesCopy}</p>
              </div>

              <CopyField label={`SMS Duyuru Metni (${result.sms.length}/160)`} value={result.sms} />
              <CopyField label="Instagram Gönderisi" value={result.instagram} />

              <button
                type="button"
                onClick={generate}
                className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Yeniden Üret
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
