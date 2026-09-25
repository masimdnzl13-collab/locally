import { redirect } from "next/navigation";
import { getMyBusiness } from "@/lib/business/current";
import { hasTidelineAccess } from "@/lib/tideline/access";
import { fetchTidelineWeeklyReport } from "@/lib/tideline/service-api";
import { panelCopy } from "@/lib/panel/copy";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

function formatDuration(seconds: number | null, fallback: string) {
  if (seconds === null) return fallback;
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

const fill = (template: string, values: Record<string, number | string>) =>
  Object.entries(values).reduce((out, [k, v]) => out.replace(`{${k}}`, String(v)), template);

// AE — işletme sahibinin kendi bakabileceği haftalık özet: Tideline sipariş
// asistanının son 7 günde ne yaptığı. Veri Tideline'ın /internal/* uçlarından
// (servis token'ı, salt okunur) gelir; restoran kimliği yalnızca oturumdaki
// işletmeden (getMyBusiness, RLS) alınır — başkasının raporu istenemez.
export default async function PanelWeeklyReportPage() {
  const business = await getMyBusiness();
  if (!business || !hasTidelineAccess(business)) redirect("/panel");

  const t = panelCopy(business.market).report;
  const result = await fetchTidelineWeeklyReport(business.tideline_restaurant_id!);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-8">
      <h1 className="text-xl font-bold tracking-tight text-foreground">{t.title}</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">{t.intro}</p>

      {!result.ok ? (
        <p className="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">{t.unavailable}</p>
      ) : result.data.calls === 0 ? (
        <p className="rounded-md border border-border bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">{t.empty}</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground">{t.calls}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{result.data.calls}</p>
                <p className="text-xs text-muted-foreground/80">{t.callsHint}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground">{t.converted}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                  {result.data.convertedCalls}
                  <span className="ml-1.5 text-sm font-semibold text-teal-700">
                    {Math.round((result.data.convertedCalls / result.data.calls) * 100)}%
                  </span>
                </p>
                <p className="text-xs text-muted-foreground/80">
                  {fill(t.convertedHint, { orders: result.data.orders, reservations: result.data.reservations })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground">{t.avgDuration}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                  {formatDuration(result.data.avgDurationSeconds, t.noDuration)}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="mt-6">
            <CardContent className="p-5">
              <h2 className="mb-3 text-sm font-bold text-foreground">{t.topIntents}</h2>
              {result.data.topIntents.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.topIntentsEmpty}</p>
              ) : (
                <ol className="space-y-2">
                  {result.data.topIntents.map((item, i) => (
                    <li key={item.intent} className="flex items-center gap-3 text-sm">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-50 text-xs font-bold text-teal-700">
                        {i + 1}
                      </span>
                      <span className="flex-1 text-foreground">{t.intents[item.intent] ?? item.intent}</span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {fill(t.callersAsked, { n: item.conversations })}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
