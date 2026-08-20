import { cn } from "@/lib/utils";
import type { SystemStatus } from "@/lib/test-lab/queries";

function Dot({ ok }: { ok: boolean }) {
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 shrink-0 rounded-full",
        ok ? "bg-success-500" : "bg-danger-500"
      )}
    />
  );
}

const ENV_LABELS: Record<string, string> = {
  NEXT_PUBLIC_SUPABASE_URL: "Supabase URL",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "Supabase Anon Key",
  SUPABASE_SERVICE_ROLE_KEY: "Supabase Service Role Key",
  NETGSM_USERCODE: "SMS (Netgsm) — yoksa simüle eder",
  RESEND_API_KEY: "E-posta (Resend) — yoksa simüle eder",
  IYZICO_API_KEY: "Ödeme (iyzico) — pilotta zaten kapalı",
  NEXT_PUBLIC_SITE_URL: "Site URL",
  CRON_SECRET: "Cron gizli anahtarı",
};

export default function SystemStatusPanel({ status }: { status: SystemStatus }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Veritabanı Bağlantısı
        </p>
        <div className="mt-2 flex items-center gap-2 text-sm">
          <Dot ok={status.dbConnected} />
          {status.dbConnected
            ? `Bağlı (${status.dbLatencyMs}ms)`
            : `Bağlanamadı${status.dbError ? ": " + status.dbError : ""}`}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Demo Veri Seti
        </p>
        <p className="mt-2 text-sm">
          {status.demoData.loaded
            ? `Yüklü — ${status.demoData.businesses} işletme, ${status.demoData.users} kullanıcı`
            : "Yüklü değil"}
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 sm:col-span-2">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Ortam Değişkenleri
        </p>
        <ul className="mt-2 space-y-1.5">
          {Object.entries(status.envVars).map(([key, ok]) => (
            <li key={key} className="flex items-center gap-2 text-sm">
              <Dot ok={ok} />
              <span className="text-foreground">{ENV_LABELS[key] ?? key}</span>
              <span className="ml-auto font-mono text-xs text-muted-foreground">
                {ok ? "var" : "yok"}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 sm:col-span-2">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Kayıt Sayıları (toplam)
        </p>
        <div className="mt-2 grid grid-cols-3 gap-3 text-center sm:grid-cols-6">
          {[
            ["İşletme", status.counts.businesses],
            ["Kullanıcı", status.counts.users],
            ["Paket", status.counts.packages],
            ["Satın Alma", status.counts.purchases],
            ["Etkinlik", status.counts.events],
            ["Flaş", status.counts.flashDeals],
          ].map(([label, value]) => (
            <div key={label as string}>
              <p className="text-lg font-bold tabular-nums text-navy-900">{value}</p>
              <p className="text-[11px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
