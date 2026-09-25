import { ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/empty-state";
import PrivacyRequestControls from "@/components/admin/privacy-request-controls";
import { PRIVACY_STATUS_LABELS, type PrivacyRequestStatus } from "@/lib/privacy/constants";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

// AO — /privacy formundan gelen silme / erişim talepleri. Açık talepler en eskisi
// üstte (yasal süre ona önce doluyor); kapananlar altta.
interface PrivacyRequest {
  id: string;
  request_type: "delete" | "access";
  requester_type: "merchant" | "caller" | "other";
  full_name: string;
  email: string;
  phone: string | null;
  business_name: string | null;
  details: string | null;
  status: PrivacyRequestStatus;
  admin_note: string | null;
  created_at: string;
  due_at: string;
  resolved_at: string | null;
}

const REQUESTER_LABELS = { merchant: "İşletme sahibi", caller: "Arayan müşteri", other: "Diğer" } as const;
const TYPE_LABELS = { delete: "Silme", access: "Verilerimi göster" } as const;

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
const daysLeft = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);

export default async function AdminPrivacyRequestsPage() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("privacy_requests")
    .select(
      "id, request_type, requester_type, full_name, email, phone, business_name, details, status, admin_note, created_at, due_at, resolved_at"
    )
    .order("created_at", { ascending: true })
    .limit(500);
  const requests = (data ?? []) as PrivacyRequest[];
  const open = requests.filter((r) => r.status === "new" || r.status === "in_progress");
  const closed = requests.filter((r) => !open.includes(r)).reverse();

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-8">
      <h1 className="mb-1 text-xl font-bold tracking-tight text-navy-900">Gizlilik Talepleri</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        /privacy formundan gelen silme ve “verilerimi göster” talepleri (CCPA). 10 iş günü içinde alındığını bildir,
        45 gün içinde yanıtla. Silmeden önce kişinin kimliğini doğrula (ör. aradığı numaraya kod gönder); arayan müşteri
        verisi Tideline&apos;da (çağrı, transkript, sipariş) durur.
      </p>

      {error && (
        <p className="mb-4 rounded-md bg-danger-50 px-3 py-2 text-sm text-danger-700">Talepler okunamadı: {error.message}</p>
      )}

      <h2 className="mb-2 text-sm font-semibold text-foreground">Açık ({open.length})</h2>
      {open.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="Açık talep yok" description="Yeni bir talep geldiğinde burada görünür." />
      ) : (
        <ul className="space-y-3">
          {open.map((r) => (
            <RequestCard key={r.id} request={r} />
          ))}
        </ul>
      )}

      {closed.length > 0 && (
        <>
          <h2 className="mb-2 mt-8 text-sm font-semibold text-foreground">Kapananlar ({closed.length})</h2>
          <ul className="space-y-3">
            {closed.map((r) => (
              <RequestCard key={r.id} request={r} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function RequestCard({ request: r }: { request: PrivacyRequest }) {
  const isOpen = r.status === "new" || r.status === "in_progress";
  const left = daysLeft(r.due_at);
  return (
    <li className="rounded-lg border border-border bg-card p-4 shadow-card">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 font-semibold",
            r.request_type === "delete" ? "bg-danger-50 text-danger-700" : "bg-muted text-foreground"
          )}
        >
          {TYPE_LABELS[r.request_type]}
        </span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{REQUESTER_LABELS[r.requester_type]}</span>
        <span className="text-muted-foreground">{fmt(r.created_at)}</span>
        {isOpen ? (
          <span className={cn("ml-auto font-semibold", left <= 7 ? "text-danger-600" : "text-muted-foreground")}>
            {left < 0 ? `Süre ${-left} gün önce doldu` : `${left} gün kaldı`}
          </span>
        ) : (
          <span className="ml-auto text-muted-foreground">
            {PRIVACY_STATUS_LABELS[r.status]}
            {r.resolved_at && ` · ${fmt(r.resolved_at)}`}
          </span>
        )}
      </div>
      <p className="mt-2 font-semibold text-foreground">
        {r.full_name}{" "}
        <a href={`mailto:${r.email}`} className="font-normal text-teal-700 hover:underline">
          {r.email}
        </a>
      </p>
      <dl className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
        {r.phone && (
          <div>
            <dt className="inline">Telefon: </dt>
            <dd className="inline text-foreground">{r.phone}</dd>
          </div>
        )}
        {r.business_name && (
          <div>
            <dt className="inline">Restoran: </dt>
            <dd className="inline text-foreground">{r.business_name}</dd>
          </div>
        )}
      </dl>
      {r.details && <p className="mt-2 whitespace-pre-line text-sm text-foreground/90">{r.details}</p>}
      <div className="mt-3 border-t border-border pt-3">
        <PrivacyRequestControls requestId={r.id} status={r.status} adminNote={r.admin_note} />
      </div>
    </li>
  );
}
