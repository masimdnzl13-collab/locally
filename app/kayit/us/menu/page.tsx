import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Circle, RefreshCw } from "lucide-react";
import TidelineFrame from "@/components/panel/tideline-frame";
import { getCurrentUsSignup } from "@/lib/onboarding-us/signup";
import { activateUsSignup, isMenuReady, MIN_HOURS_DAYS, MIN_MENU_ITEMS } from "@/lib/onboarding-us/complete";
import { getTidelineBrainReadiness } from "@/lib/tideline/service-api";
import { US_LOGIN_PATH } from "@/lib/us/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Add your menu · Locally",
};

function Step({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      {done ? (
        <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-teal-600" />
      ) : (
        <Circle size={18} className="mt-0.5 shrink-0 text-muted-foreground" />
      )}
      <span className={done ? "text-muted-foreground" : "text-foreground"}>{children}</span>
    </li>
  );
}

// P-V — ABD onboarding menü adımı (ödeme + Tideline kurulumundan sonra).
// Saat ve menü Tideline'ın Brain'inde yaşar; burada sıfırdan form yazmak
// yerine Tideline panelindeki mevcut Brain düzenleyicisi SSO ile gömülür
// (TidelineFrame, section="brain"); Brain sayfası varsayılan olarak saat + menü
// formunu açar, JSON düzenleyicisi küçük bir "Advanced" bağlantısında durur
// (tideline/apps/web/src/pages/BrainForm.tsx). Sayfa her yüklemede Tideline'dan sayıları
// okur; eşik tutunca başvuru "active" olur (bkz. lib/onboarding-us/complete.ts).
export default async function UsMenuStepPage() {
  const current = await getCurrentUsSignup();
  if (!current) redirect("/kayit/us");
  if (current.signup.status === "awaiting_payment") redirect("/kayit/us/odeme");

  const signup =
    current.signup.status === "active"
      ? current.signup
      : ((await activateUsSignup(current.signup.business_id)) ?? current.signup);
  const restaurantId = signup.business.tideline_restaurant_id;
  if (signup.status === "active" || !restaurantId) redirect("/kayit/us/durum");

  const readiness = await getTidelineBrainReadiness(restaurantId);
  const counts = readiness.ok ? readiness.data : null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      <div className="mb-6 max-w-3xl">
        <p className="text-sm font-medium text-teal-700">Last step</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">Add your hours and menu</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your assistant answers callers from this information. Your setup isn&apos;t complete until your
          opening hours and at least {MIN_MENU_ITEMS} menu items are in.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        <aside className="space-y-5">
          <div className="rounded-lg border border-border p-4">
            <ul className="space-y-3">
              <Step done={Boolean(counts && counts.hoursDays >= MIN_HOURS_DAYS)}>
                Opening hours{counts ? ` — ${counts.hoursDays} of 7 days set` : ""}
              </Step>
              <Step done={Boolean(counts && counts.menuItems >= MIN_MENU_ITEMS)}>
                At least {MIN_MENU_ITEMS} menu items{counts ? ` — ${counts.menuItems} added` : ""}
              </Step>
            </ul>
            {!counts && (
              <p className="mt-3 text-xs text-muted-foreground">
                We couldn&apos;t check your progress right now. Your changes are still saved.
              </p>
            )}
            <Link
              href="/kayit/us/menu"
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-md bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-800"
            >
              <RefreshCw size={14} /> I&apos;ve added them — check again
            </Link>
            {counts && isMenuReady(counts) && (
              <p className="mt-2 text-xs text-teal-700">Looks complete — checking again will finish your setup.</p>
            )}
          </div>

          <div className="rounded-lg border border-border p-4 text-sm">
            <p className="font-medium text-foreground">How to fill it in</p>
            <ol className="mt-3 list-decimal space-y-2 pl-4 text-muted-foreground">
              <li>
                <strong className="text-foreground">Opening hours</strong> — tick the days you&apos;re open, set
                the times, then <em>Save hours</em>.
              </li>
              <li>
                <strong className="text-foreground">Menu</strong> — add a category (like &ldquo;Pizzas&rdquo;),
                then its items with a name and price. Click <em>Save menu</em>.
              </li>
              <li>Come back here and check again.</li>
            </ol>
          </div>
        </aside>

        {current.signedIn ? (
          <TidelineFrame
            section="brain"
            locale="en"
            title="Restaurant Brain"
            className="flex h-[75dvh] min-h-[32rem] flex-col overflow-hidden rounded-lg border border-border"
          />
        ) : (
          <div className="flex items-center justify-center rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">
            <p>
              Please confirm your email address, then{" "}
              <Link
                href={`${US_LOGIN_PATH}?next=${encodeURIComponent("/kayit/us/menu")}`}
                className="font-semibold text-teal-700 underline"
              >
                log in
              </Link>{" "}
              to add your menu.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
