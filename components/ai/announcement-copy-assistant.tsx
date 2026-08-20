"use client";

import { useState, useTransition } from "react";
import { Sparkles, Check, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import ToneSelector from "@/components/ai/tone-selector";
import { generateAnnouncementCopyAction } from "@/lib/ai/actions";
import type { AnnouncementCopyResult, CampaignTone } from "@/lib/ai/types";
import type { Segment } from "@/lib/customers/segments";

export default function AnnouncementCopyAssistant({
  segment,
  onApply,
}: {
  segment: Segment;
  onApply: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tone, setTone] = useState<CampaignTone>("samimi");
  const [result, setResult] = useState<AnnouncementCopyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const [isPending, startTransition] = useTransition();

  function generate() {
    setError(null);
    setApplied(false);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("segment", segment);
      formData.set("tone", tone);
      const res = await generateAnnouncementCopyAction(formData);
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
                <p className="whitespace-pre-wrap text-sm text-foreground">{result.message}</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    onApply(result.message);
                    setApplied(true);
                  }}
                  className="flex items-center gap-1 rounded-md bg-navy-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-800"
                >
                  {applied ? <Check className="h-3.5 w-3.5" /> : null}
                  {applied ? "Uygulandı" : "Alana Aktar"}
                </button>
                <button
                  type="button"
                  onClick={generate}
                  className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Yeniden Üret
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
