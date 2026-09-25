import { CreditCard } from "lucide-react";
import { getMyBusiness } from "@/lib/business/current";
import { getBusinessBilling } from "@/lib/billing/subscriptions";
import { billingCopy } from "@/lib/billing/copy";
import CancelSubscriptionForm from "@/components/panel/cancel-subscription-form";

export const dynamic = "force-dynamic";

// TR (iyzico) ve US (Stripe) işletmeleri için ortak Faturalandırma sayfası.
// Sağlayıcı businesses.market'e göre seçilir (lib/payments), veriler yalnızca
// oturumdaki kullanıcının kendi işletmesi için çekilir (getMyBusiness).
export default async function BillingPage() {
  const business = await getMyBusiness();
  if (!business) return null;

  const t = billingCopy(business.market);
  const billing = await getBusinessBilling(business.id, business.market);
  const { subscription, live } = billing;

  const formatDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(t.locale, { day: "numeric", month: "long", year: "numeric" }) : null;
  const formatMoney = (amount: number | null, currency: string | null) =>
    amount != null && currency
      ? new Intl.NumberFormat(t.locale, { style: "currency", currency: currency.toUpperCase() }).format(amount)
      : null;

  const periodEnd = live?.currentPeriodEnd ?? subscription?.currentPeriodEnd ?? null;
  const cancelAtPeriodEnd = Boolean(live?.cancelAtPeriodEnd ?? subscription?.cancelAtPeriodEnd);
  const status = live?.status ?? subscription?.status ?? null;
  const price = formatMoney(live?.amount ?? null, live?.currency ?? null);
  const isActive = subscription && subscription.status !== "canceled" && status !== "canceled";

  return (
    <div className="mx-auto max-w-xl px-4 py-6 md:px-8 md:py-8">
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-foreground">{t.title}</h1>
      <p className="mb-6 text-sm text-muted-foreground">{t.intro}</p>

      {!subscription ? (
        <div className="rounded-lg border border-border bg-muted px-4 py-4 text-sm text-muted-foreground">
          {business.market === "TR" ? t.noSubscriptionTr : t.noSubscription}
        </div>
      ) : (
        <div className="space-y-4">
          {billing.simulated && (
            <p className="rounded-md bg-discount-50 px-3 py-2 text-xs text-discount-700">{t.simulated}</p>
          )}
          {billing.liveError && (
            <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">{t.liveUnavailable}</p>
          )}
          {status === "past_due" && (
            <p className="rounded-md bg-danger-50 px-3 py-2 text-sm text-danger-700">{t.pastDue}</p>
          )}
          {isActive && cancelAtPeriodEnd && (
            <p className="rounded-md bg-discount-50 px-3 py-2 text-sm text-discount-700">
              {periodEnd ? t.cancelScheduled.replace("{date}", formatDate(periodEnd)!) : t.cancelScheduledNoDate}
            </p>
          )}
          {!isActive && <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">{t.canceled}</p>}

          <dl className="divide-y divide-border rounded-lg border border-border bg-card text-sm shadow-card">
            <Row label={t.plan}>
              <span className="font-semibold text-foreground">{live?.planName ?? t.planFallback}</span>
              {price && (
                <span className="text-muted-foreground">
                  {" "}
                  · {price}
                  {live?.interval ? ` / ${t.perInterval[live.interval] ?? live.interval}` : ""}
                </span>
              )}
            </Row>
            <Row label={t.status}>{status ? t.statuses[status] ?? status : "—"}</Row>
            {isActive && (
              <Row label={cancelAtPeriodEnd ? t.endsOn : t.nextInvoice}>{formatDate(periodEnd) ?? "—"}</Row>
            )}
            <Row label={t.paymentMethod}>
              {live?.paymentMethod ? (
                <span className="inline-flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" aria-hidden />
                  <span className="capitalize">{live.paymentMethod.brand}</span> •••• {live.paymentMethod.last4}
                  <span className="text-xs text-muted-foreground">
                    ({t.expires} {String(live.paymentMethod.expMonth).padStart(2, "0")}/
                    {String(live.paymentMethod.expYear).slice(-2)})
                  </span>
                </span>
              ) : (
                <span className="text-muted-foreground">{t.noPaymentMethod}</span>
              )}
            </Row>
            {subscription.lastPaymentAt && <Row label={t.lastPayment}>{formatDate(subscription.lastPaymentAt)}</Row>}
            <Row label={t.providerLabel}>{t.provider[billing.provider]}</Row>
          </dl>

          {isActive && !cancelAtPeriodEnd && (
            <div className="pt-2">
              <CancelSubscriptionForm copy={t.cancel} periodEndLabel={formatDate(periodEnd)} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right text-foreground">{children}</dd>
    </div>
  );
}
