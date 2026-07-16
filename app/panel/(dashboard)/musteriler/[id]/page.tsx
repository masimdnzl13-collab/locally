import { notFound } from "next/navigation";
import { getMyBusiness } from "@/lib/business/current";
import { getCustomer, getCustomerDetail } from "@/lib/customers/queries";
import CustomerNotes from "@/components/panel/customer-notes";
import { Card, CardContent } from "@/components/ui/card";

const KIND_ICON: Record<string, string> = {
  paket: "🎁",
  flas: "🔥",
  etkinlik: "🎉",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("tr-TR", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function CustomerDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const business = await getMyBusiness();
  if (!business) return null;

  const customer = await getCustomer(params.id, business.id);
  if (!customer) notFound();

  const detail = await getCustomerDetail(params.id);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-8 md:py-8">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        {customer.full_name || "İsimsiz Müşteri"}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">{customer.phone}</p>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Ziyaret</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{customer.visit_count}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">İlk Ziyaret</p>
            <p className="mt-1 text-sm font-bold text-foreground">
              {customer.first_visit_at ? formatDateTime(customer.first_visit_at) : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Son Ziyaret</p>
            <p className="mt-1 text-sm font-bold text-foreground">
              {customer.last_visit_at ? formatDateTime(customer.last_visit_at) : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardContent className="p-5">
          <h2 className="mb-3 text-sm font-bold text-foreground">Not</h2>
          <CustomerNotes customerId={customer.id} initialNotes={customer.notes} />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardContent className="p-5">
          <h2 className="mb-3 text-sm font-bold text-foreground">Aldığı Paketler</h2>
          {!detail || detail.packages.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Henüz paket satın almamış.</p>
          ) : (
            <ul className="divide-y divide-border">
              {detail.packages.map((p) => (
                <li key={p.qr_code} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="font-medium text-foreground">{p.package_title}</span>
                  <span className="text-xs font-semibold text-muted-foreground">
                    kalan {p.remaining_uses} / {p.usage_count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardContent className="p-5">
          <h2 className="mb-3 text-sm font-bold text-foreground">Ziyaret Geçmişi</h2>
          {!detail || detail.timeline.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Henüz ziyaret kaydı yok.</p>
          ) : (
            <ul className="space-y-3">
              {detail.timeline.map((t, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span className="text-lg">{KIND_ICON[t.kind] ?? "•"}</span>
                  <div>
                    <p className="font-medium text-foreground">{t.label}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(t.occurred_at)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="mt-8 rounded-md bg-muted px-4 py-3 text-xs text-muted-foreground">
        🔒 Bu müşteri verileri yalnızca senin işletmene ait ve gizlidir.
      </p>
    </div>
  );
}
