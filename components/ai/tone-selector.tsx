"use client";

import { cn } from "@/lib/utils";
import { TONE_LABELS, type CampaignTone } from "@/lib/ai/types";

const TONES: CampaignTone[] = ["samimi", "sik", "esprili"];

export default function ToneSelector({
  value,
  onChange,
}: {
  value: CampaignTone;
  onChange: (tone: CampaignTone) => void;
}) {
  return (
    <div className="flex gap-1.5">
      {TONES.map((tone) => (
        <button
          key={tone}
          type="button"
          onClick={() => onChange(tone)}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
            value === tone
              ? "border-teal-600 bg-teal-50 text-teal-700"
              : "border-border text-muted-foreground hover:bg-muted"
          )}
        >
          {TONE_LABELS[tone]}
        </button>
      ))}
    </div>
  );
}
