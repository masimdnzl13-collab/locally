import type { Metadata } from "next";
import UsShell from "@/components/us/us-shell";
import {
  US_GOVERNING_LAW,
  US_LEGAL_ENTITY,
  US_MONTHLY_PRICE_USD,
  US_SUPPORT_EMAIL,
  US_TERMS_EFFECTIVE_DATE,
  US_TERMS_VERSION,
} from "@/lib/us/config";

export const metadata: Metadata = {
  title: "Terms of Service & Merchant Agreement",
  description: "The agreement between Locally and restaurants using the Locally AI phone assistant in the United States.",
  alternates: { canonical: "/terms" },
};

// Plain-language merchant agreement for the US product. The version string is
// what the signup checkbox records (lib/onboarding-us AGREEMENT_VERSION); any
// material change to this text needs a new version there and here.
const SECTIONS: { id: string; title: string; body: React.ReactNode }[] = [
  {
    id: "service",
    title: "1. The service",
    body: (
      <>
        <p>
          Locally provides an AI phone assistant for restaurants (the &quot;Service&quot;). The Service answers calls to
          a phone number we provide, answers questions using the information you give us, takes takeout orders, books
          reservations, sends text-message confirmations to your guests, and shows calls, transcripts, orders and
          reservations in your dashboard.
        </p>
        <p>
          &quot;You&quot; or &quot;Merchant&quot; means the business that signs up. &quot;We&quot;, &quot;us&quot; or
          &quot;Locally&quot; means {US_LEGAL_ENTITY}. By checking the agreement box at signup, or by using the
          Service, you agree to this Agreement on behalf of your business and confirm you are authorized to do so.
        </p>
      </>
    ),
  },
  {
    id: "subscription",
    title: "2. Subscription and payment",
    body: (
      <>
        <p>
          The Service is a monthly subscription, currently <strong>${US_MONTHLY_PRICE_USD} per month per location</strong>,
          plus any applicable taxes. The first payment is charged when you sign up; after that, your subscription renews
          automatically every month and is charged to your payment method on file at the start of each billing period.
          Payments are processed by our payment provider (Stripe); we do not store your full card details.
        </p>
        <p>
          If a payment fails, we will notify you and retry. If payment is still outstanding 14 days after the due date,
          we may suspend the Service until the balance is paid.
        </p>
        <p>
          We may change the price with at least 30 days&apos; notice by email. The new price applies from your next
          billing period after the notice period ends. If you do not agree, you can cancel before it takes effect.
        </p>
      </>
    ),
  },
  {
    id: "cancellation",
    title: "3. Cancellation and termination",
    body: (
      <>
        <p>
          There is no minimum term. You can cancel at any time from your dashboard or by contacting us. Cancellation
          takes effect at the end of the billing period you have already paid for; the Service keeps working until then.
          We do not give refunds or credits for partial months, except where required by law.
        </p>
        <p>
          We may suspend or terminate the Service immediately if you materially breach this Agreement (including
          non-payment or unlawful use), or with 30 days&apos; notice for any other reason, in which case we will refund
          any prepaid fees for the period after termination.
        </p>
        <p>
          After termination, the phone number we provided may be released. If you ask within 30 days after termination, we
          will send you an export of your orders, reservations and call records; after that we may delete your data as
          described in section 6.
        </p>
      </>
    ),
  },
  {
    id: "responsibilities",
    title: "4. Your responsibilities",
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <strong>Accurate information.</strong> Keep your menu, prices, hours, closures and policies in the dashboard
          up to date. The assistant relies on what you provide.
        </li>
        <li>
          <strong>Reviewing orders and reservations.</strong> Check incoming orders and reservations in your dashboard
          and confirm them with your normal kitchen and front-of-house process.
        </li>
        <li>
          <strong>Call recording and caller notice.</strong> Calls handled by the Service are processed and transcribed.
          Some states require every party to consent to a call being recorded. You agree to give callers any
          notice the law requires (for example, in the assistant&apos;s greeting, which you can customize) and to comply
          with the call-recording laws that apply to your business.
        </li>
        <li>
          <strong>Text messages.</strong> Confirmation texts are sent only in connection with an order or reservation a
          guest requested. You will not use the Service to send marketing messages without the consent required by law
          (including the Telephone Consumer Protection Act).
        </li>
        <li>
          <strong>Lawful use.</strong> You will not use the Service for anything illegal, deceptive or harmful, or try to
          access other customers&apos; data or interfere with the Service.
        </li>
        <li>
          <strong>Your account.</strong> Keep your login secure. You are responsible for activity under your account.
        </li>
      </ul>
    ),
  },
  {
    id: "ai",
    title: "5. How the AI works — and its limits",
    body: (
      <>
        <p>
          The assistant uses speech recognition and large language models to understand callers and respond. It is
          designed to confirm details back to the caller and to say when it does not know something rather than guess.
          Even so, it can mishear a caller, misunderstand a request, or make a mistake.
        </p>
        <p>
          The Service is a tool to help your staff, not a replacement for your judgment. You remain responsible for the
          food you prepare, the prices you charge and the commitments you make to guests. The assistant must not be
          relied on for allergy or medical assurances beyond the information you have entered, and it will not take
          payment card details over the phone.
        </p>
      </>
    ),
  },
  {
    id: "data",
    title: "6. Your data and how we use it",
    body: (
      <>
        <p>
          <strong>What we process.</strong> To run the Service we process call audio, transcripts, caller phone numbers,
          names and details guests give during calls, orders, reservations, and the restaurant information you enter
          (&quot;Merchant Data&quot;).
        </p>
        <p>
          <strong>You own your Merchant Data.</strong> We use it only to provide, secure, support and improve the
          Service for you. We do not sell Merchant Data or guests&apos; personal information, and we do not use it to
          advertise to your guests.
        </p>
        <p>
          <strong>Service providers.</strong> We share data only with providers that help us run the Service, under
          confidentiality and data-protection obligations — for example telephony and text messaging (Twilio), speech
          recognition and voice (Deepgram), AI language models (Anthropic), payments (Stripe) and hosting. These
          providers process data on our behalf, not for their own marketing.
        </p>
        <p>
          <strong>Improving the Service.</strong> We may use aggregated, de-identified information (for example,
          average call length or common question types) to improve the Service. It will not identify you or your
          guests.
        </p>
        <p>
          <strong>Retention and security.</strong> We keep Merchant Data while your account is active and for up to 90
          days after termination, unless the law requires us to keep it longer. We use industry-standard measures to
          protect it, including encryption in transit and access controls. If we become aware of a security breach
          affecting your Merchant Data, we will notify you without undue delay.
        </p>
      </>
    ),
  },
  {
    id: "availability",
    title: "7. Availability and support",
    body: (
      <p>
        We work to keep the Service available around the clock and monitor it for failures, but it depends on phone
        carriers, internet connectivity and third-party providers, so we cannot guarantee it will be uninterrupted or
        error-free. We may carry out maintenance and will try to schedule it outside typical restaurant hours. You can
        forward calls back to your own line at any time.
      </p>
    ),
  },
  {
    id: "warranty",
    title: "8. Disclaimer",
    body: (
      <p className="uppercase">
        Except as expressly stated in this Agreement, the Service is provided &quot;as is&quot; and &quot;as
        available&quot;, and we disclaim all other warranties, express or implied, including warranties of
        merchantability, fitness for a particular purpose and non-infringement, to the fullest extent permitted by law.
      </p>
    ),
  },
  {
    id: "liability",
    title: "9. Limitation of liability",
    body: (
      <>
        <p className="uppercase">
          To the fullest extent permitted by law, neither party will be liable for any indirect, incidental, special,
          consequential or punitive damages, or for lost profits, lost revenue or lost orders, even if advised of the
          possibility. Each party&apos;s total liability arising out of or relating to this Agreement is limited to the
          amount you paid us for the Service in the 12 months before the event giving rise to the claim.
        </p>
        <p>
          These limits do not apply to your payment obligations, to either party&apos;s indemnity obligations, or to
          liability that cannot be limited by law.
        </p>
      </>
    ),
  },
  {
    id: "indemnity",
    title: "10. Indemnity",
    body: (
      <p>
        You will defend and indemnify us against third-party claims arising from the food and services you provide,
        inaccurate information you give us, or your breach of section 4. We will defend and indemnify you against
        third-party claims that the Service, as we provide it, infringes their intellectual property rights.
      </p>
    ),
  },
  {
    id: "general",
    title: "11. Changes and general terms",
    body: (
      <>
        <p>
          We may update this Agreement. For material changes we will email you at least 30 days before they take effect;
          continuing to use the Service after that date means you accept the updated terms. If you do not agree, you can
          cancel before the changes take effect.
        </p>
        <p>
          This Agreement is governed by the laws of {US_GOVERNING_LAW}, without regard to its conflict-of-laws rules.
          If any part is found unenforceable, the rest remains in effect. This Agreement is the entire agreement between
          us about the Service. You may not assign it without our consent, except as part of the sale of your business.
        </p>
        {US_SUPPORT_EMAIL && (
          <p>
            Questions about this Agreement:{" "}
            <a href={`mailto:${US_SUPPORT_EMAIL}`} className="underline">
              {US_SUPPORT_EMAIL}
            </a>
            .
          </p>
        )}
      </>
    ),
  },
];

export default function TermsPage() {
  return (
    <UsShell>
      <article className="mx-auto max-w-3xl px-4 py-12 md:px-8 md:py-16">
        <h1 className="text-3xl font-bold tracking-tight text-navy-900 dark:text-foreground">
          Terms of Service &amp; Merchant Agreement
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Effective {US_TERMS_EFFECTIVE_DATE} · Version {US_TERMS_VERSION}
        </p>
        <p className="mt-6 rounded-lg border border-border bg-muted/60 p-4 text-sm">
          <strong>In short:</strong> ${US_MONTHLY_PRICE_USD}/month per location, billed monthly, cancel anytime (it stops
          at the end of the paid month). You keep your menu and hours accurate and follow call-recording and texting
          laws. We keep your data private, never sell it, and only share it with the providers needed to run the
          Service. The AI can make mistakes, so review orders as you normally would.
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
          </ol>
        </nav>

        <div className="mt-10 space-y-10">
          {SECTIONS.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-20">
              <h2 className="text-lg font-semibold text-foreground">{s.title}</h2>
              <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-foreground/90">{s.body}</div>
            </section>
          ))}
        </div>
      </article>
    </UsShell>
  );
}
