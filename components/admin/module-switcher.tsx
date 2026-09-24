"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Snowflake, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { runWinterActivationNowAction, setWinterModuleAction } from "@/lib/admin/module-actions";

export interface ModuleRow {
  id: string;
  name: string;
  market: "TR" | "US";
  city: string;
  active_modules: string[];
}

const MODULE_LABELS: Record<string, string> = { tideline: "Tideline (yaz)", locally_core: "Locally (kış)" };

export default function ModuleSwitcher({ rows }: { rows: ModuleRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const allSelected = rows.length > 0 && selected.size === rows.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function run(action: () => Promise<{ error?: string; message?: string }>) {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      setMessage(result.error ? { tone: "error", text: result.error } : { tone: "ok", text: result.message ?? "Tamam." });
      if (!result.error) {
        setSelected(new Set());
        router.refresh();
      }
    });
  }

  function setWinter(mode: "add" | "remove", ids: string[]) {
    const fd = new FormData();
    fd.set("mode", mode);
    ids.forEach((id) => fd.append("businessId", id));
    run(() => setWinterModuleAction(fd));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="teal"
          disabled={isPending || selected.size === 0}
          onClick={() => setWinter("add", Array.from(selected))}
        >
          <Snowflake size={14} className="mr-1.5" /> Seçilenlere kış modülünü aç ({selected.size})
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={isPending || selected.size === 0}
          onClick={() => setWinter("remove", Array.from(selected))}
        >
          <Sun size={14} className="mr-1.5" /> Seçilenlerden kaldır
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={isPending}
          className="ml-auto"
          onClick={() => run(runWinterActivationNowAction)}
        >
          1 Ekim geçişini şimdi çalıştır
        </Button>
      </div>

      {message && (
        <p
          className={
            message.tone === "error"
              ? "rounded-md border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700"
              : "rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800"
          }
        >
          {message.text}
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="w-10 px-4 py-2.5">
                <input
                  type="checkbox"
                  aria-label="Tümünü seç"
                  checked={allSelected}
                  onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
                />
              </th>
              <th className="px-4 py-2.5 font-medium">İşletme</th>
              <th className="px-4 py-2.5 font-medium">Pazar</th>
              <th className="px-4 py-2.5 font-medium">Aktif Modüller</th>
              <th className="px-4 py-2.5 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => {
              const hasWinter = r.active_modules.includes("locally_core");
              return (
                <tr key={r.id} className="odd:bg-muted/60 hover:bg-muted">
                  <td className="px-4 py-2.5">
                    <input
                      type="checkbox"
                      aria-label={`${r.name} seç`}
                      checked={selected.has(r.id)}
                      onChange={() => toggle(r.id)}
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <p className="font-semibold text-foreground">{r.name}</p>
                    <p className="text-xs text-muted-foreground">{r.city}</p>
                  </td>
                  <td className="px-4 py-2.5 text-xs font-semibold text-muted-foreground">{r.market}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {r.active_modules.length === 0 && (
                        <span className="text-xs text-muted-foreground">Yok (ödeme bekliyor)</span>
                      )}
                      {r.active_modules.map((m) => (
                        <span
                          key={m}
                          className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-700"
                        >
                          {MODULE_LABELS[m] ?? m}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isPending}
                      onClick={() => setWinter(hasWinter ? "remove" : "add", [r.id])}
                    >
                      {hasWinter ? "Kışı kapat" : "Kışı aç"}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
