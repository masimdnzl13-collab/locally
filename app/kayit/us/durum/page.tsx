import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Clock, Loader2, MailCheck, Sparkles } from "lucide-react";
import AuthShell from "@/components/auth/auth-shell";
import { getCurrentUsSignup, type UsSignup } from "@/lib/onboarding-us/signup";
import { activateUsSignup, findActiveSubscriptionRef, markUsSignupPaid } from "@/lib/onboarding-us/complete";
import { getStripeClient } from "@/lib/stripe/client";
import { US_LOGIN_PATH } from "@/lib/us/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Setting up · Locally",
};

function stripeConfigured() {
  try {
    return getStripeClient() !== null;
  } catch {
    return true;
  }
}

// P6 — 3/3: ödeme dönüşü ve kurulum durumu. Hem Stripe'ın success_url'i hem
// panelin "US kaydı yarım" yönlendirmesi buraya gelir. Sayfa idempotent:
// ödeme doğrulanınca tideline modülünü açar ve Tideline kurulumunu dener
// (bkz. lib/onboarding-us/complete.ts); tekrar yüklenmesi güvenlidir.
export default async function UsStatusPage({
  searchParams,
}: {
  searchParams: { session_id?: string; simulated?: string };
}) {
  const current = await getCurrentUsSignup();
  if (!current) redirect("/kayit/us");
  let signup: UsSignup | null = current.signup;

  if (signup.status === "awaiting_payment") {
    if (!stripeConfigured()) {
      // Test modu: sağlayıcı ödemeyi simüle edip ?simulated=1 ile döner.
      if (searchParams.simulated !== "1") redirect("/kayit/us/odeme");
      await markUsSignupPaid(signup.business_id, { mode: "test", ref: `TEST-${Date.now()}` });
    } else {
      // Gerçek ödeme: tek kanıt, Stripe webhook'unun yazdığı aktif abonelik.
      const subscriptionRef = await findActiveSubscriptionRef(signup.business_id);
      if (!subscriptionRef) {
        if (!searchParams.session_id) redirect("/kayit/us/odeme");
        return (
          <AuthShell title="Confirming your payment" description="This usually takes a few seconds.">
            {/* Webhook gelene kadar sayfa kendini yeniler. */}
            <meta httpEquiv="refresh" content="4" />
            <div className="flex flex-col items-center gap-3 text-center text-sm text-muted-foreground">
              <Loader2 className="animate-spin text-teal-600" size={28} />
              <p>We&apos;re waiting for Stripe to confirm your subscription. This page will refresh automatically.</p>
            </div>
          </AuthShell>
        );
      }
      await markUsSignupPaid(signup.business_id, { mode: "stripe", ref: subscriptionRef });
    }
  }

  if (signup.status !== "active" || !signup.business.tideline_restaurant_id) {
    signup = (await activateUsSignup(signup.business_id)) ?? signup;
  }

  const ready = Boolean(signup.business.tideline_restaurant_id) && signup.tideline_phone_status === "active";

  return (
    <AuthShell title={`Welcome to Locally, ${signup.business.name}`}>
      <div className="space-y-5 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-600">
          <Sparkles size={22} strokeWidth={1.75} />
        </div>
        <p className="text-base font-semibold text-foreground">Your Tideline ordering assistant is being activated.</p>

        {ready ? (
          <div className="space-y-2 rounded-md border border-border p-4 text-sm">
            <p className="flex items-center justify-center gap-1.5 font-medium text-foreground">
              <CheckCircle2 size={16} className="text-teal-600" /> Your restaurant phone number is ready
            </p>
            <p className="font-mono text-lg text-foreground">{signup.tideline_phone_number}</p>
            <p className="text-muted-foreground">
              Add your menu and hours in the dashboard so your assistant can start taking orders.
            </p>
          </div>
        ) : (
          <div className="space-y-2 rounded-md border border-border bg-muted/40 p-4 text-sm">
            <p className="flex items-center justify-center gap-1.5 font-medium text-foreground">
              <Clock size={16} className="text-discount-700" /> Your setup will be completed within 24 hours
            </p>
            <p className="text-muted-foreground">
              We&apos;re assigning a dedicated phone number to your restaurant. We&apos;ll email you as soon as
              everything is ready — there&apos;s nothing else you need to do right now.
            </p>
          </div>
        )}

        {current.signedIn ? (
          <Link
            href={ready ? "/panel/tideline" : "/panel"}
            className="flex w-full items-center justify-center rounded-md bg-navy-900 px-4 py-3 text-sm font-semibold text-white hover:bg-navy-800"
          >
            Go to your dashboard
          </Link>
        ) : (
          <div className="flex items-start gap-2 rounded-md bg-teal-50 px-3 py-2 text-left text-sm text-teal-800">
            <MailCheck size={16} className="mt-0.5 shrink-0" />
            <span>
              Please confirm your email address using the link we sent you, then{" "}
              <Link href={US_LOGIN_PATH} className="font-semibold underline">
                sign in
              </Link>{" "}
              to your dashboard.
            </span>
          </div>
        )}
      </div>
    </AuthShell>
  );
}
