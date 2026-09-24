import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, Clock, Languages, LayoutDashboard, MessageSquareText, PhoneCall, ShoppingBag } from "lucide-react";
import UsShell from "@/components/us/us-shell";
import { US_MONTHLY_PRICE_USD, US_SIGNUP_HREF, US_TERMS_PATH } from "@/lib/us/config";

export const metadata: Metadata = {
  title: "AI phone assistant for restaurants",
  description:
    "Locally answers every call to your restaurant, takes takeout orders and books tables in English and Spanish — 24/7, for a flat monthly price.",
  alternates: { canonical: "/us" },
  openGraph: {
    title: "Locally — AI phone assistant for restaurants",
    description: "Every call answered. Orders taken, tables booked, in English and Spanish.",
    locale: "en_US",
    type: "website",
  },
};

const FEATURES = [
  {
    icon: PhoneCall,
    title: "Answers every call",
    body: "Rush hour, after closing, or when the line is already busy — callers get a friendly, natural voice instead of a ringing phone.",
  },
  {
    icon: ShoppingBag,
    title: "Takes takeout orders",
    body: "Reads from your real menu, handles modifiers, repeats the order back, and confirms the total before it lands on your dashboard.",
  },
  {
    icon: CalendarCheck,
    title: "Books reservations",
    body: "Checks your hours and table rules, books the party, and sends the guest a confirmation text.",
  },
  {
    icon: Languages,
    title: "English and Spanish",
    body: "Detects the caller's language and answers in it — no menu of options, no “press 2”.",
  },
  {
    icon: MessageSquareText,
    title: "Knows your restaurant",
    body: "Hours, closures, parking, allergens, specials: you fill in the answers once, the assistant uses them on every call.",
  },
  {
    icon: LayoutDashboard,
    title: "One dashboard",
    body: "Every call, order and reservation in one place, with transcripts, so you always know what was promised to whom.",
  },
];

const STEPS = [
  { title: "Sign up", body: "Create your account and start your subscription in a few minutes." },
  { title: "Add your menu and hours", body: "Enter your menu, hours and common questions — or send them to us and we'll set it up." },
  { title: "Forward your calls", body: "We give you a local number. Forward your line to it (all calls or only missed ones) and you're live." },
];

const INCLUDED = [
  "Unlimited answered calls",
  "Takeout orders and table reservations",
  "English and Spanish",
  "SMS confirmations to your guests",
  "Dashboard with call transcripts",
  "Local US phone number",
  "Cancel anytime — no contract",
];

const FAQ = [
  {
    q: "Does it replace my staff?",
    a: "No. It picks up the calls your team can't — during rushes, after hours, or while they're serving guests. You can transfer callers to a person whenever you like.",
  },
  {
    q: "What if the assistant can't answer a question?",
    a: "It says so honestly, offers to take a message or transfer the call, and never invents prices, hours or availability you haven't given it.",
  },
  {
    q: "Do I need new hardware or a new phone number?",
    a: "No. Keep your existing number and simply forward calls to the line we provide.",
  },
  {
    q: "How do I cancel?",
    a: "From your dashboard, anytime. Your subscription stays active until the end of the month you've already paid for.",
  },
];

export default function UsLandingPage() {
  return (
    <UsShell>
      <section className="border-b border-border bg-card">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-[1.2fr_1fr] md:items-center md:px-8 md:py-20">
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-teal-700">AI phone assistant for restaurants</p>
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-navy-900 dark:text-foreground md:text-5xl">
              Never miss another call — or another order.
            </h1>
            <p className="mt-4 max-w-xl text-lg text-muted-foreground">
              Locally answers your restaurant&apos;s phone 24/7 with a natural voice, takes takeout orders and books
              tables in English and Spanish, and sends everything to one simple dashboard.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href={US_SIGNUP_HREF}
                className="rounded-md bg-teal-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-teal-700"
              >
                Sign up — ${US_MONTHLY_PRICE_USD}/month
              </Link>
              <Link href="#how-it-works" className="text-sm font-semibold text-navy-900 hover:underline dark:text-foreground">
                See how it works →
              </Link>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">No contract. Cancel anytime.</p>
          </div>

          <figure className="rounded-xl border border-border bg-background p-5 shadow-card" aria-label="Example call">
            <figcaption className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Clock className="h-3.5 w-3.5" /> Example call · 9:47 PM
            </figcaption>
            <ol className="space-y-3 text-sm">
              {[
                ["Assistant", "Thanks for calling! How can I help you tonight?"],
                ["Caller", "Can I get a large pepperoni for pickup?"],
                ["Assistant", "Sure — one large pepperoni. Anything else? … That's $18.50, ready in about 20 minutes. Can I get a name?"],
                ["Caller", "Maria."],
                ["Assistant", "Got it, Maria. You'll get a text confirmation in a moment."],
              ].map(([who, line], i) => (
                <li key={i} className={who === "Caller" ? "text-right" : undefined}>
                  <span
                    className={`inline-block max-w-[85%] rounded-lg px-3 py-2 text-left ${
                      who === "Caller" ? "bg-teal-50 text-teal-900" : "bg-muted text-foreground"
                    }`}
                  >
                    {line}
                  </span>
                </li>
              ))}
            </ol>
          </figure>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 md:px-8">
        <h2 className="text-2xl font-bold tracking-tight text-navy-900 dark:text-foreground">What it does</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-lg border border-border bg-card p-5 shadow-card">
              <Icon className="h-5 w-5 text-teal-600" aria-hidden />
              <h3 className="mt-3 font-semibold text-foreground">{title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-16 border-y border-border bg-muted/60">
        <div className="mx-auto max-w-6xl px-4 py-14 md:px-8">
          <h2 className="text-2xl font-bold tracking-tight text-navy-900 dark:text-foreground">Live in three steps</h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="rounded-lg bg-card p-5 shadow-card">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-navy-900 text-sm font-bold text-white">
                  {i + 1}
                </span>
                <h3 className="mt-3 font-semibold text-foreground">{step.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-14 md:px-8">
        <h2 className="text-2xl font-bold tracking-tight text-navy-900 dark:text-foreground">Simple pricing</h2>
        <div className="mt-8 max-w-md rounded-xl border-2 border-teal-600 bg-card p-6 shadow-card">
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Locally for restaurants</p>
          <p className="mt-2 text-4xl font-bold tracking-tight text-navy-900 dark:text-foreground">
            ${US_MONTHLY_PRICE_USD}
            <span className="text-base font-medium text-muted-foreground"> / month per location</span>
          </p>
          <ul className="mt-5 space-y-2 text-sm">
            {INCLUDED.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-teal-600" aria-hidden>
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
          <Link
            href={US_SIGNUP_HREF}
            className="mt-6 block rounded-md bg-teal-600 px-6 py-3 text-center font-semibold text-white hover:bg-teal-700"
          >
            Sign up
          </Link>
          <p className="mt-3 text-xs text-muted-foreground">
            Billed monthly. Taxes may apply. See the{" "}
            <Link href={US_TERMS_PATH} className="underline hover:text-foreground">
              Merchant Agreement
            </Link>
            .
          </p>
        </div>
      </section>

      <section className="border-t border-border bg-card">
        <div className="mx-auto max-w-3xl px-4 py-14 md:px-8">
          <h2 className="text-2xl font-bold tracking-tight text-navy-900 dark:text-foreground">Questions</h2>
          <dl className="mt-6 divide-y divide-border">
            {FAQ.map(({ q, a }) => (
              <div key={q} className="py-4">
                <dt className="font-semibold text-foreground">{q}</dt>
                <dd className="mt-1.5 text-sm text-muted-foreground">{a}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-8">
            <Link
              href={US_SIGNUP_HREF}
              className="inline-block rounded-md bg-teal-600 px-6 py-3 font-semibold text-white hover:bg-teal-700"
            >
              Get started
            </Link>
          </div>
        </div>
      </section>
    </UsShell>
  );
}
