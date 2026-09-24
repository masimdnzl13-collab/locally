"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  assignTidelineNumberAction,
  retryTidelineNumberAction,
  retryUsActivationAction,
} from "@/lib/admin/module-actions";

type Action = (fd: FormData) => Promise<{ error?: string; message?: string }>;

function useAction() {
  const router = useRouter();
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(action: Action, fields: Record<string, string>) {
    setMessage(null);
    startTransition(async () => {
      const fd = new FormData();
      Object.entries(fields).forEach(([k, v]) => fd.set(k, v));
      const result = await action(fd);
      setMessage(result.error ? { tone: "error", text: result.error } : { tone: "ok", text: result.message ?? "Tamam." });
      if (!result.error) router.refresh();
    });
  }

  const feedback = message && (
    <p className={message.tone === "error" ? "text-xs text-danger-600" : "text-xs text-teal-700"}>{message.text}</p>
  );
  return { run, isPending, feedback };
}

export function RetryActivationButton({ businessId }: { businessId: string }) {
  const { run, isPending, feedback } = useAction();
  return (
    <div className="space-y-1 text-right">
      <Button size="sm" variant="outline" disabled={isPending} onClick={() => run(retryUsActivationAction, { businessId })}>
        Tekrar dene
      </Button>
      {feedback}
    </div>
  );
}

export function PendingNumberActions({ numberId, externalRef }: { numberId: string; externalRef: string | null }) {
  const { run, isPending, feedback } = useAction();
  const [phoneNumber, setPhoneNumber] = useState("");
  const ref = externalRef ?? "";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder="+1XXXXXXXXXX"
          className="h-9 w-40 text-xs"
        />
        <Button
          size="sm"
          variant="teal"
          disabled={isPending || !phoneNumber.trim()}
          onClick={() => run(assignTidelineNumberAction, { numberId, externalRef: ref, phoneNumber })}
        >
          Elle ata
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => run(retryTidelineNumberAction, { numberId, externalRef: ref })}
        >
          Otomatik tekrar dene
        </Button>
      </div>
      {feedback}
    </div>
  );
}
