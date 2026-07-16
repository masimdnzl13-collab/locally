"use client";

import { Button } from "@/components/ui/button";
import type { WaitlistEntry } from "@/lib/admin/queries";

export default function WaitlistExportButton({ entries }: { entries: WaitlistEntry[] }) {
  function handleExport() {
    const header = "email,created_at\n";
    const rows = entries
      .map((e) => `${e.email},${new Date(e.created_at).toISOString()}`)
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kurucu-500-bekleme-listesi-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button onClick={handleExport} disabled={entries.length === 0} variant="teal" size="sm">
      CSV Olarak Dışa Aktar
    </Button>
  );
}
