import { getWaitlist } from "@/lib/admin/queries";
import WaitlistExportButton from "@/components/admin/waitlist-export-button";

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
        <h1 className="text-xl font-extrabold tracking-tight text-dark-900">
          Bekleme Listesi ({entries.length})
        </h1>
        <WaitlistExportButton entries={entries} />
      </div>

      {entries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white py-10 text-center text-sm text-slate-400">
          Henüz kayıt yok.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 text-xs text-slate-400">
              <tr>
                <th className="px-4 py-2.5 font-medium">E-posta</th>
                <th className="px-4 py-2.5 font-medium">Kayıt Tarihi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map((entry) => (
                <tr key={entry.email}>
                  <td className="px-4 py-2.5 text-dark-900">{entry.email}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-400">
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
