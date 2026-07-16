import Link from "next/link";
import { notFound } from "next/navigation";
import { getMyBusiness } from "@/lib/business/current";
import { getMyEventDetail } from "@/lib/events/queries";
import CancelEventButton from "@/components/panel/cancel-event-button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function formatTL(n: number) {
  return n.toLocaleString("tr-TR") + "₺";
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("tr-TR", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const PAYMENT_LABEL: Record<string, string> = {
  active: "Ödendi",
  used: "Giriş yapıldı",
  cancelled: "İptal edildi",
};

export default async function PanelEventDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const business = await getMyBusiness();
  if (!business) return null;

  const event = await getMyEventDetail(params.id, business.id);
  if (!event) notFound();

  const started = new Date(event.event_at) < new Date();

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {event.title}
            </h1>
            {event.is_cancelled && <Badge variant="danger">İptal Edildi</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{formatDateTime(event.event_at)}</p>
        </div>
        <div className="flex gap-2">
          {!event.is_cancelled && (
            <Link
              href={`/panel/etkinlikler/${event.id}/duzenle`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Düzenle
            </Link>
          )}
          {!event.is_cancelled && <CancelEventButton eventId={event.id} />}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Katılımcı</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
              {event.ticket_count}
              {event.capacity !== null ? ` / ${event.capacity}` : ""}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Tür</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
              {event.is_paid ? formatTL(event.ticket_price ?? 0) : "Ücretsiz"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Durum</p>
            <p className="mt-1 text-xl font-bold text-foreground">
              {event.is_cancelled ? "İptal" : started ? "Başladı" : "Yaklaşıyor"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-5">
          <h2 className="mb-3 text-sm font-bold text-foreground">
            Katılımcılar — kapıda yoklama için QR Doğrula sekmesini kullan
          </h2>
          {event.participants.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Henüz kayıt yok.</p>
          ) : (
            <ul className="divide-y divide-border">
              {event.participants.map((p) => (
                <li key={p.ticket_id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">
                      {p.full_name || p.phone || "İsimsiz katılımcı"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Kayıt: {formatDateTime(p.created_at)}
                      {event.is_paid && p.price_paid ? ` · ${formatTL(p.price_paid)}` : ""}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                      p.status === "used"
                        ? "bg-success-50 text-success-700"
                        : p.status === "cancelled"
                          ? "bg-danger-50 text-danger-600"
                          : "bg-teal-50 text-teal-700"
                    }`}
                  >
                    {p.refund_status === "iade_sureci_baslatildi"
                      ? "İade süreci başlatıldı"
                      : PAYMENT_LABEL[p.status] ?? p.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
