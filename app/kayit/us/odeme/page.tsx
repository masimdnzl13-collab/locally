import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CreditCard, FlaskConical } from "lucide-react";
import AuthShell from "@/components/auth/auth-shell";
import CheckoutButton from "@/components/onboarding-us/checkout-button";
import { getCurrentUsSignup } from "@/lib/onboarding-us/signup";
import { getStripeClient } from "@/lib/stripe/client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Payment · Locally",
};

function stripeConfigured() {
  try {
    return getStripeClient() !== null;
  } catch {
    return true; // yanlış yapılandırılmış canlı anahtar: action hatayı gösterir
  }
}

// P6 — 2/3: ödeme. Kart bilgisi Stripe'ın hosted Checkout sayfasında girilir;
// STRIPE_SECRET_KEY yoksa test modunda simüle edilir.
export default async function UsPaymentPage({ searchParams }: { searchParams: { canceled?: string } }) {
  const current = await getCurrentUsSignup();
  if (!current) redirect("/kayit/us");
  if (current.signup.status !== "awaiting_payment") redirect("/kayit/us/durum");

  const testMode = !stripeConfigured();

  return (
    <AuthShell title="Almost there" description={`Start your Locally subscription for ${current.signup.business.name}`}>
      <div className="space-y-4">
        {searchParams.canceled && (
          <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            Payment was canceled — no charge was made. You can try again whenever you&apos;re ready.
          </p>
        )}

        <div className="flex items-start gap-3 rounded-md border border-border p-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700">
            <CreditCard size={18} strokeWidth={1.75} />
          </span>
          <div className="text-sm">
            <p className="font-semibold text-foreground">Locally monthly subscription</p>
            <p className="text-muted-foreground">
              Includes your AI ordering assistant and a dedicated restaurant phone number. Cancel anytime.
            </p>
          </div>
        </div>

        {testMode && (
          <div className="flex items-start gap-2 rounded-md bg-discount-50 px-3 py-2 text-xs text-discount-700">
            <FlaskConical size={14} className="mt-0.5 shrink-0" />
            <span>Test mode: payments aren&apos;t connected yet, so no card will be charged.</span>
          </div>
        )}

        <CheckoutButton label={testMode ? "Complete test payment" : "Continue to secure payment"} />

        <p className="text-center text-xs text-muted-foreground">Payments are processed securely by Stripe.</p>
      </div>
    </AuthShell>
  );
}
