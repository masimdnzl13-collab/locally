import Link from "next/link";
import { notFound } from "next/navigation";
import { getMyBusiness } from "@/lib/business/current";
import { getMyEventDetail } from "@/lib/events/queries";
import CancelEventButton from "@/components/panel/cancel-event-button";

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
            <h1 className="text-2xl font-extrabold tracking-tight text-dark-900">
              {event.title}
            </h1>
            {event.is_cancelled && (
              <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-600">
                İptal Edildi
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">{formatDateTime(event.event_at)}</p>
        </div>
        <div className="flex gap-2">
          {!event.is_cancelled && (
            <Link
              href={`/panel/etkinlikler/${event.id}/duzenle`}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-dark-900 hover:bg-slate-50"
            >
              Düzenle
            </Link>
          )}
          {!event.is_cancelled && <CancelEventButton eventId={event.id} />}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-400">Katılımcı</p>
          <p className="mt-1 text-xl font-extrabold text-dark-900">
            {event.ticket_count}
            {event.capacity !== null ? ` / ${event.capacity}` : ""}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-400">Tür</p>
          <p className="mt-1 text-xl font-extrabold text-dark-900">
            {event.is_paid ? formatTL(event.ticket_price ?? 0) : "Ücretsiz"}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-400">Durum</p>
          <p className="mt-1 text-xl font-extrabold text-dark-900">
            {event.is_cancelled ? "İptal" : started ? "Başladı" : "Yaklaşıyor"}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-bold text-dark-900">
          Katılımcılar — kapıda yoklama için QR Doğrula sekmesini kullan
        </h2>
        {event.participants.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">Henüz kayıt yok.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {event.participants.map((p) => (
              <li key={p.ticket_id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-dark-900">
                    {p.full_name || p.phone || "İsimsiz katılımcı"}
                  </p>
                  <p className="text-xs text-slate-400">
                    Kayıt: {formatDateTime(p.created_at)}
                    {event.is_paid && p.price_paid ? ` · ${formatTL(p.price_paid)}` : ""}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                    p.status === "used"
                      ? "bg-primary/10 text-primary-700"
                      : p.status === "cancelled"
                        ? "bg-red-50 text-red-600"
                        : "bg-slate-100 text-slate-600"
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
      </div>
    </div>
  );
}
