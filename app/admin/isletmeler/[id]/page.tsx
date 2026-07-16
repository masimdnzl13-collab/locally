import { notFound } from "next/navigation";
import { getBusinessDetailForAdmin } from "@/lib/admin/queries";
import { BUSINESS_CATEGORY_LABELS } from "@/lib/types";
import BusinessReviewActions from "@/components/admin/business-review-actions";
import { Stamp } from "@/components/ui/stamp";

const STATUS_LABEL: Record<string, string> = {
  pending: "Bekliyor",
  approved: "Onaylı",
  rejected: "Reddedildi",
  suspended: "Askıda",
};

const STATUS_TONE: Record<string, "ink" | "accent" | "primary" | "brick"> = {
  pending: "accent",
  approved: "primary",
  rejected: "brick",
  suspended: "brick",
};

export default async function AdminBusinessDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const business = await getBusinessDetailForAdmin(params.id);
  if (!business) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-8 md:py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink-900">{business.name}</h1>
          <p className="text-sm text-muted-foreground">{BUSINESS_CATEGORY_LABELS[business.category]}</p>
        </div>
        <Stamp label={STATUS_LABEL[business.approval_status]} tone={STATUS_TONE[business.approval_status]} />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3">
        <div className="h-32 overflow-hidden rounded-xl border border-border bg-muted">
          {business.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={business.logo_url} alt="Logo" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-3xl">🏪</div>
          )}
        </div>
        <div className="h-32 overflow-hidden rounded-xl border border-border bg-muted">
          {business.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={business.cover_url} alt="Kapak" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-3xl">🖼️</div>
          )}
        </div>
      </div>

      <div className="mb-6 space-y-2 rounded-xl border border-border bg-card p-4 text-sm text-foreground">
        <p>
          <span className="text-muted-foreground">Açıklama:</span> {business.description ?? "—"}
        </p>
        <p>
          <span className="text-muted-foreground">Adres:</span> {business.address ?? "—"},{" "}
          {business.district ? `${business.district}, ` : ""}
          {business.city}
        </p>
        <p>
          <span className="text-muted-foreground">Telefon:</span> {business.phone ?? "—"}
        </p>
        <p>
          <span className="text-muted-foreground">Instagram:</span> {business.instagram ?? "—"}
        </p>
        <p>
          <span className="text-muted-foreground">Sahibi:</span> {business.owner?.full_name ?? "—"} ·{" "}
          {business.owner?.phone ?? "—"}
        </p>
        {business.suspend_reason && (
          <p className="text-tile-600">
            <span className="text-muted-foreground">Gerekçe:</span> {business.suspend_reason}
          </p>
        )}
      </div>

      <BusinessReviewActions businessId={business.id} status={business.approval_status} />
    </div>
  );
}
