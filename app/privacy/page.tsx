import type { Metadata } from "next";
import Link from "next/link";
import UsShell from "@/components/us/us-shell";
import PrivacyRequestForm from "@/components/us/privacy-request-form";
import { US_LEGAL_ENTITY, US_PRIVACY_EFFECTIVE_DATE, US_SUPPORT_EMAIL, US_TERMS_PATH } from "@/lib/us/config";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "What information the Locally AI phone assistant collects from restaurants and their callers, how long we keep it, who we share it with, and how to ask us to delete it.",
  alternates: { canonical: "/privacy" },
};

// AO — plain-language privacy notice for the US product (CCPA/CPRA). Keep it true to the code:
// retention matches section 6 of /terms, and the provider list matches what the Service actually
// calls. When either changes, update this page and US_PRIVACY_EFFECTIVE_DATE (lib/us/config.ts).

const PROVIDERS: { name: string; purpose: string; data: string }[] = [
  { name: "Twilio", purpose: "Phone calls and text messages", data: "Caller and restaurant phone numbers, call audio in real time, text message content" },
  { name: "Deepgram", purpose: "Speech recognition and the assistant's voice", data: "Call audio in real time, text the assistant speaks" },
  { name: "Anthropic", purpose: "AI model that understands the caller and decides what to say", data: "Call transcript, the restaurant's menu, hours and policies" },
  { name: "PayPal and Stripe", purpose: "Subscription and ticket payments", data: "Restaurant billing details (we never see or store full card numbers)" },
  { name: "Supabase", purpose: "Database and restaurant logins", data: "Restaurant account and business information" },
  { name: "Vercel and Fly.io", purpose: "Hosting for our website and voice service", data: "All Service data, stored and processed on their servers" },
  { name: "Resend", purpose: "Account emails", data: "Restaurant email address and message content" },
];

const SECTIONS: { id: string; title: string; body: React.ReactNode }[] = [
  {
    id: "who",
    title: "1. Who we are",
    body: (
      <>
        <p>
          {US_LEGAL_ENTITY} (&quot;Locally&quot;, &quot;we&quot;) runs an AI phone assistant that answers calls for
          restaurants, takes takeout orders and reservations, and texts guests their confirmations. This policy covers
          two groups of people: <strong>restaurants</strong> that use Locally, and <strong>callers</strong> who phone
          one of those restaurants.
        </p>
        <p>
          For callers, the restaurant decides to use Locally and we process your information on its behalf (under
          California law we are its &quot;service provider&quot;). You can still send your request straight to us —
          we&apos;ll handle it or pass it to the restaurant.
        </p>
      </>
    ),
  },
  {
    id: "collect",
    title: "2. What we collect",
    body: (
      <>
        <p>
          <strong>When you call a restaurant that uses Locally:</strong>
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong>Your phone number</strong> (from caller ID).
          </li>
          <li>
            <strong>A written transcript of the call.</strong> Call audio is streamed to our speech-recognition provider
            to produce the transcript while you talk; we do not keep a recording of the call.
          </li>
          <li>
            <strong>Order and reservation details</strong> you give — for example your name, the items you ordered,
            special requests, and the date, time and party size of a booking.
          </li>
          <li>
            <strong>Text messages</strong> we send you about your order or reservation, and whether you&apos;ve asked us
            to stop texting you.
          </li>
        </ul>
        <p>
          <strong>When a restaurant signs up:</strong> the contact name, email, phone and address you give us; your
          restaurant&apos;s menu, hours and policies; subscription and billing status (payments are handled by PayPal
          or Stripe — we don&apos;t store full card numbers); and the calls, orders and reservations the assistant
          handles for you.
        </p>
        <p>
          <strong>On our website:</strong> cookies that keep you logged in and remember basic preferences, and standard
          server logs (such as IP address) used for security and to stop abuse. We don&apos;t use advertising cookies
          or trackers.
        </p>
      </>
    ),
  },
  {
    id: "use",
    title: "3. How we use it",
    body: (
      <ul className="list-disc space-y-1.5 pl-5">
        <li>To answer the call, take the order or booking, and send the confirmation text.</li>
        <li>To show the restaurant its calls, transcripts, orders and reservations in its dashboard.</li>
        <li>To bill restaurants, provide support, and keep the Service secure (for example, blocking abusive callers).</li>
        <li>
          To improve the Service using aggregated, de-identified information (such as average call length) that
          doesn&apos;t identify anyone.
        </li>
      </ul>
    ),
  },
  {
    id: "sharing",
    title: "4. Who we share it with",
    body: (
      <>
        <p>
          <strong>We do not sell personal information, and we do not share it for advertising.</strong> We share it
          only with the restaurant you called (it&apos;s their order or reservation) and with the providers below, who
          process it on our behalf to run the Service and are not allowed to use it for their own purposes.
        </p>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Provider</th>
                <th className="px-3 py-2 font-medium">What for</th>
                <th className="px-3 py-2 font-medium">What they receive</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {PROVIDERS.map((p) => (
                <tr key={p.name}>
                  <td className="px-3 py-2 font-medium text-foreground">{p.name}</td>
                  <td className="px-3 py-2">{p.purpose}</td>
                  <td className="px-3 py-2 text-muted-foreground">{p.data}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          We may also disclose information if the law requires it, or to protect people from harm or fraud.
        </p>
      </>
    ),
  },
  {
    id: "texts",
    title: "5. Text messages",
    body: (
      <>
        <p>
          We text you only about an order or reservation you made. Reply <strong>STOP</strong> at any time and we will
          not text that number again; reply <strong>START</strong> to resume or <strong>HELP</strong> for help.
          Message and data rates may apply.
        </p>
        <p>
          No mobile information will be shared with third parties or affiliates for marketing or promotional purposes.
          Your opt-in and opt-out status is never shared with anyone except the providers that deliver the messages.
        </p>
      </>
    ),
  },
  {
    id: "retention",
    title: "6. How long we keep it",
    body: (
      <ul className="list-disc space-y-1.5 pl-5">
        <li>
          <strong>Call transcripts, orders and reservations</strong> are kept while the restaurant&apos;s account is
          active and for up to 90 days after it closes (see section 6 of our{" "}
          <Link href={US_TERMS_PATH} className="underline">
            Merchant Agreement
          </Link>
          ), unless you ask us to delete them sooner or the law requires us to keep them longer.
        </li>
        <li>
          <strong>Restaurant account and billing records</strong> are kept for the same period, except payment records
          we must keep for tax and accounting law.
        </li>
        <li>
          <strong>&quot;Stop texting me&quot; records</strong> are kept for as long as we send texts, so that we keep
          honoring your choice.
        </li>
        <li>
          <strong>Privacy requests</strong> (below) are kept for 24 months, as California law requires.
        </li>
        <li>
          <strong>Server logs</strong> are kept only briefly by our hosting providers for security and troubleshooting.
        </li>
      </ul>
    ),
  },
  {
    id: "rights",
    title: "7. Your rights",
    body: (
      <>
        <p>
          Wherever you live, you can ask us to <strong>tell you what information we have</strong> about you,{" "}
          <strong>delete it</strong>, or <strong>correct it</strong>. California residents have these rights under the
          CCPA/CPRA, along with the right not to be discriminated against for using them. Because we don&apos;t sell or
          share personal information for advertising, there is nothing to opt out of.
        </p>
        <p>
          Use the form below or email us. We&apos;ll confirm we got your request within 10 business days and respond
          within 45 days. To protect you, we may need to confirm your identity first — for example by texting a code to
          the phone number you called from. You can also have an authorized agent make the request for you.
        </p>
        <p>
          Some information we may have to keep even after a deletion request — for example records needed to complete
          an order you placed, to detect fraud, or that the law requires us to keep. If so, we&apos;ll tell you.
        </p>
      </>
    ),
  },
  {
    id: "security",
    title: "8. Security and children",
    body: (
      <>
        <p>
          We protect information with encryption in transit, access controls that limit each restaurant to its own
          data, and by keeping personal details out of our system logs. No system is perfectly secure; if a breach
          affects your information, we will notify you as the law requires.
        </p>
        <p>The Service is for restaurants and their adult customers. We don&apos;t knowingly collect information from children under 13.</p>
      </>
    ),
  },
  {
    id: "changes",
    title: "9. Changes and contact",
    body: (
      <>
        <p>
          If we change this policy we&apos;ll update the date at the top, and tell restaurants by email before any
          material change takes effect.
        </p>
        {US_SUPPORT_EMAIL && (
          <p>
            Questions:{" "}
            <a href={`mailto:${US_SUPPORT_EMAIL}`} className="underline">
              {US_SUPPORT_EMAIL}
            </a>
          </p>
        )}
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <UsShell>
      <article className="mx-auto max-w-3xl px-4 py-12 md:px-8 md:py-16">
        <h1 className="text-3xl font-bold tracking-tight text-navy-900 dark:text-foreground">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Effective {US_PRIVACY_EFFECTIVE_DATE}</p>
        <p className="mt-6 rounded-lg border border-border bg-muted/60 p-4 text-sm">
          <strong>In short:</strong> when you call a restaurant that uses Locally, we keep your phone number, a
          transcript of the call (not a recording) and your order or booking, so the restaurant can serve you. We share
          it only with the restaurant and the providers that run the Service, never sell it, and delete it on request.
          Reply STOP to any text to stop them.{" "}
          <a href="#request" className="font-semibold underline">
            Ask us to delete your information →
          </a>
        </p>

        <nav aria-label="Sections" className="mt-8 text-sm">
          <ol className="grid gap-1 sm:grid-cols-2">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-teal-700 hover:underline">
                  {s.title}
                </a>
              </li>
            ))}
            <li>
              <a href="#request" className="text-teal-700 hover:underline">
                10. Make a request
              </a>
            </li>
          </ol>
        </nav>

        <div className="mt-10 space-y-10">
          {SECTIONS.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-20">
              <h2 className="text-lg font-semibold text-foreground">{s.title}</h2>
              <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-foreground/90">{s.body}</div>
            </section>
          ))}
          <section id="request" className="scroll-mt-20">
            <h2 className="text-lg font-semibold text-foreground">10. Make a request</h2>
            <p className="mb-4 mt-3 text-[15px] leading-relaxed text-foreground/90">
              Ask us to delete your information or to tell you what we have. It takes a minute; we reply by email.
            </p>
            <PrivacyRequestForm />
          </section>
        </div>
      </article>
    </UsShell>
  );
}
