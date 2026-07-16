import { Mail } from "lucide-react";
import { getWaitlist } from "@/lib/admin/queries";
import WaitlistExportButton from "@/components/admin/waitlist-export-button";
import { EmptyState } from "@/components/ui/empty-state";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminWaitlistPage() {
  const entries = await getWaitlist();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-8 md:py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight text-ink-900">
          Bekleme Listesi ({entries.length})
        </h1>
        <WaitlistExportButton entries={entries} />
      </div>

      {entries.length === 0 ? (
        <EmptyState icon={Mail} title="Henüz kayıt yok" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">E-posta</th>
                <th className="px-4 py-2.5 font-medium">Kayıt Tarihi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map((entry) => (
                <tr key={entry.email} className="odd:bg-sand-50">
                  <td className="px-4 py-2.5 text-ink-900">{entry.email}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {formatDateTime(entry.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
