import { Building2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { getOnboardingIncompleteBusinesses } from "@/lib/admin/queries";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
}

function formatRelative(iso: string | null) {
  if (!iso) return "Hiç giriş yapmadı";
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 1) return "1 saatten az önce";
  if (hours < 24) return `${hours} sa önce`;
  const days = Math.floor(hours / 24);
  return `${days} gün önce`;
}

function missingSteps(b: {
  district: string | null;
  address: string | null;
  phone: string | null;
  logo_url: string | null;
  cover_url: string | null;
  has_package: boolean;
  qr_stand_viewed_at: string | null;
}) {
  const missing: string[] = [];
  if (!(b.district && b.address && b.phone)) missing.push("İşletme bilgileri");
  if (!(b.logo_url && b.cover_url)) missing.push("Görseller");
  if (!b.has_package) missing.push("İlk paket");
  if (!b.qr_stand_viewed_at) missing.push("QR standı");
  return missing;
}

export default async function AdminOnboardingTrackingPage() {
  const businesses = await getOnboardingIncompleteBusinesses();

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-8">
      <h1 className="mb-1 text-xl font-bold tracking-tight text-navy-900">Kurulum Takibi</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Hesabını açmış ama kurulumunu tamamlamamış işletmeler — {businesses.length} kayıt.
      </p>

      {businesses.length === 0 ? (
        <EmptyState icon={Building2} title="Yarım kalan kurulum yok" description="Tüm işletmeler kurulumunu tamamlamış." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">İşletme</th>
                <th className="px-4 py-2.5 font-medium">Kayıt Tarihi</th>
                <th className="px-4 py-2.5 font-medium">Kalan Adımlar</th>
                <th className="px-4 py-2.5 font-medium">İletişim</th>
                <th className="px-4 py-2.5 font-medium">Son Giriş</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {businesses.map((b) => {
                const missing = missingSteps(b);
                const contactPhone = b.phone ?? b.owner_phone;
                return (
                  <tr key={b.id} className="odd:bg-muted/60 hover:bg-muted">
                    <td className="px-4 py-2.5 font-semibold text-foreground">{b.name}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{formatDate(b.created_at)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {missing.map((m) => (
                          <span
                            key={m}
                            className="rounded-full bg-discount-50 px-2 py-0.5 text-[10px] font-semibold text-discount-700"
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-foreground">
                      {contactPhone ?? "—"}
                      <p className="text-xs text-muted-foreground">{b.owner_email}</p>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {formatRelative(b.last_sign_in_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
