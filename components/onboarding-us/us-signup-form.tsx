"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { startUsSignupAction } from "@/lib/onboarding-us/actions";
import { US_STATES } from "@/lib/onboarding-us/us-states";
import { US_LOGIN_PATH } from "@/lib/us/config";
import SubmitButton from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</p>;
}

export default function UsSignupForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await startUsSignupAction(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      {/* Honeypot: ekran dışı, tab sırasında yok, ekran okuyucudan gizli.
          Doluysa sunucu isteği sessizce yok sayar (lib/onboarding-us/actions.ts). */}
      <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label>
          Company website
          <input type="text" name="company_website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
      <SectionTitle>Restaurant</SectionTitle>
      <Field label="Restaurant name">
        <Input name="businessName" required maxLength={120} placeholder="Harbor Grill" />
      </Field>
      <Field label="Street address">
        <Input name="street" required autoComplete="address-line1" placeholder="123 Main St" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="City">
          <Input name="city" required autoComplete="address-level2" placeholder="Miami" />
        </Field>
        <Field label="ZIP code">
          <Input name="postalCode" required inputMode="numeric" autoComplete="postal-code" placeholder="33139" />
        </Field>
      </div>
      <Field label="State">
        <select
          name="state"
          required
          defaultValue=""
          className="flex h-12 w-full rounded-input border border-border bg-card px-4 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="" disabled>
            Select a state
          </option>
          {US_STATES.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>

      <SectionTitle>Contact</SectionTitle>
      <Field label="Your name">
        <Input name="contactName" required autoComplete="name" placeholder="Jane Smith" />
      </Field>
      <Field label="Phone">
        <Input name="phone" type="tel" required autoComplete="tel" placeholder="(305) 555-0123" />
      </Field>
      <Field label="Email">
        <Input name="email" type="email" required autoComplete="email" placeholder="you@restaurant.com" />
      </Field>
      <Field label="Password">
        <Input name="password" type="password" required minLength={8} autoComplete="new-password" placeholder="At least 8 characters" />
      </Field>

      <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        <details>
          <summary className="cursor-pointer font-medium text-foreground">Key terms</summary>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>Locally is billed as a monthly subscription; you can cancel anytime from your dashboard.</li>
            <li>Your AI ordering assistant answers calls on a dedicated phone number that Locally provides.</li>
            <li>Call recordings and transcripts are processed only to take orders and reservations for your restaurant.</li>
            <li>You are responsible for keeping your menu, hours and prices up to date.</li>
          </ul>
        </details>
        <label className="mt-3 flex items-start gap-2 text-sm text-foreground">
          <input type="checkbox" name="agreement" required className="mt-0.5 h-4 w-4 accent-teal-600" />
          <span>
            I have read and agree to the{" "}
            <Link href="/terms" target="_blank" className="font-semibold text-teal-700 underline">
              Locally Terms &amp; Merchant Agreement
            </Link>
            .
          </span>
        </label>
      </div>

      {error && <p className="rounded-md bg-danger-50 px-3 py-2 text-sm text-danger-600">{error}</p>}

      <SubmitButton pending={isPending} pendingLabel="One moment...">
        Continue to payment
      </SubmitButton>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href={US_LOGIN_PATH} className="font-semibold text-teal-700">
          Sign in
        </Link>
      </p>
    </form>
  );
}
