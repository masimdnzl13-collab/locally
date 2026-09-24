import type { Db } from "../database/db.js";
import { runWithTenant } from "../database/tenant-context.js";
import type { AlertNotifier } from "../alerts/notifier.js";

// USD per million tokens (Anthropic first-party list prices). ai_usage rows only
// carry token counts; estimated_cost wins when a row has one.
export const MODEL_PRICING_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-fable-5-1": { input: 10, output: 50 },
  "claude-fable-5": { input: 10, output: 50 },
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-opus-5": { input: 5, output: 25 },
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-opus-4-7": { input: 5, output: 25 },
  "claude-opus-4-6": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};
// Unknown models (and the mock provider) are priced like the default model so an
// unrecognised id overestimates rather than silently hiding spend.
const FALLBACK_PRICING = MODEL_PRICING_PER_MTOK["claude-opus-5"];

export function aiCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  if (model === "mock") return 0;
  const key = Object.keys(MODEL_PRICING_PER_MTOK)
    .sort((a, b) => b.length - a.length)
    .find((id) => model === id || model.startsWith(`${id}-`) || model.endsWith(id));
  const price = key ? MODEL_PRICING_PER_MTOK[key] : FALLBACK_PRICING;
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
}

export type CostRates = {
  subscriptionPriceUsd: number;
  thresholdRatio: number;
  twilioPerMinute: number;
  sttPerMinute: number;
  ttsPerMinute: number;
};
export type CostWindow = { from: Date; to: Date; period: string };
export type RestaurantCost = {
  restaurantId: string;
  restaurantName: string;
  period: string;
  from: string;
  to: string;
  ai: { usd: number; inputTokens: number; outputTokens: number };
  voice: { calls: number; billedMinutes: number; usd: number };
  totalUsd: number;
  thresholdUsd: number;
  overThreshold: boolean;
};

const round = (value: number) => Math.round(value * 10_000) / 10_000;

/** UTC calendar month containing `now` (the billing period the guard compares against). */
export function monthWindow(now = new Date()): CostWindow {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { from, to, period: from.toISOString().slice(0, 7) };
}
/** UTC calendar day containing `now`. */
export function dayWindow(now = new Date()): CostWindow {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const to = new Date(from.getTime() + 86_400_000);
  return { from, to, period: from.toISOString().slice(0, 10) };
}

/**
 * Per-restaurant cost roll-up: Claude tokens from ai_usage plus voice minutes
 * (Twilio + STT + TTS) from calls. Voice minutes are billed per started minute
 * per call, like Twilio does. All rates are estimates driven by env.
 */
export class CostService {
  constructor(
    private readonly db: Db,
    private readonly rates: CostRates,
  ) {}

  get thresholdUsd() {
    return round(this.rates.subscriptionPriceUsd * this.rates.thresholdRatio);
  }

  async restaurantCost(restaurant: { id: string; name: string }, window: CostWindow): Promise<RestaurantCost> {
    // ai_usage is under forced RLS: read it inside the restaurant's tenant context.
    const [usage, calls] = await runWithTenant(restaurant.id, () =>
      Promise.all([
        this.db.query<{ model: string; input_tokens: string; output_tokens: string; unknown_input: string; unknown_output: string; known_cost: string }>(
          `SELECT model,
             COALESCE(SUM(input_tokens),0) AS input_tokens,
             COALESCE(SUM(output_tokens),0) AS output_tokens,
             COALESCE(SUM(CASE WHEN estimated_cost IS NULL THEN input_tokens ELSE 0 END),0) AS unknown_input,
             COALESCE(SUM(CASE WHEN estimated_cost IS NULL THEN output_tokens ELSE 0 END),0) AS unknown_output,
             COALESCE(SUM(estimated_cost),0) AS known_cost
           FROM ai_usage WHERE restaurant_id=$1 AND created_at >= $2 AND created_at < $3
           GROUP BY model`,
          [restaurant.id, window.from, window.to],
        ),
        this.db.query<{ calls: string; billed_minutes: string }>(
          `SELECT COUNT(*) AS calls, COALESCE(SUM(CEIL(duration_seconds / 60.0)),0) AS billed_minutes
           FROM calls WHERE restaurant_id=$1 AND started_at >= $2 AND started_at < $3`,
          [restaurant.id, window.from, window.to],
        ),
      ]),
    );
    let aiUsd = 0,
      inputTokens = 0,
      outputTokens = 0;
    for (const row of usage.rows) {
      inputTokens += Number(row.input_tokens);
      outputTokens += Number(row.output_tokens);
      aiUsd += Number(row.known_cost) + aiCostUsd(row.model, Number(row.unknown_input), Number(row.unknown_output));
    }
    const billedMinutes = Number(calls.rows[0]?.billed_minutes ?? 0);
    const voiceUsd = billedMinutes * (this.rates.twilioPerMinute + this.rates.sttPerMinute + this.rates.ttsPerMinute);
    const totalUsd = round(aiUsd + voiceUsd);
    return {
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      period: window.period,
      from: window.from.toISOString(),
      to: window.to.toISOString(),
      ai: { usd: round(aiUsd), inputTokens, outputTokens },
      voice: { calls: Number(calls.rows[0]?.calls ?? 0), billedMinutes, usd: round(voiceUsd) },
      totalUsd,
      thresholdUsd: this.thresholdUsd,
      overThreshold: totalUsd > this.thresholdUsd,
    };
  }

  async restaurants(ids?: string[]) {
    const { rows } = ids
      ? await this.db.query<{ id: string; name: string }>("SELECT id,name FROM restaurants WHERE id = ANY($1::uuid[]) ORDER BY name", [ids])
      : await this.db.query<{ id: string; name: string }>("SELECT id,name FROM restaurants WHERE status='ACTIVE' ORDER BY name");
    return rows;
  }

  async allCosts(window: CostWindow, ids?: string[]) {
    const out: RestaurantCost[] = [];
    // Sequential on purpose: keeps pool pressure flat; restaurant counts are small.
    for (const restaurant of await this.restaurants(ids)) out.push(await this.restaurantCost(restaurant, window));
    return out;
  }
}

/**
 * Extension point for what happens when a restaurant crosses the threshold.
 * Today only `notifyAdmin` is wired; a future action (e.g. switch to a cheaper
 * model, cap call length, flag for account review) implements this interface and
 * is added to the CostGuard's action list — each action is deduplicated per
 * restaurant per period on its own name.
 */
export interface CostThresholdAction {
  name: string;
  run(cost: RestaurantCost): Promise<void>;
}

export function notifyAdminAction(notifier: AlertNotifier): CostThresholdAction {
  return {
    name: "notify_admin",
    run: (cost) =>
      notifier.send({
        subject: `Tideline maliyet uyarısı: ${cost.restaurantName}`,
        text: [
          `${cost.restaurantName} (${cost.restaurantId}) ${cost.period} maliyeti $${cost.totalUsd.toFixed(2)} — eşik $${cost.thresholdUsd.toFixed(2)}.`,
          `AI (Claude): $${cost.ai.usd.toFixed(2)} (${cost.ai.inputTokens} girdi / ${cost.ai.outputTokens} çıktı token)`,
          `Ses: $${cost.voice.usd.toFixed(2)} (${cost.voice.calls} çağrı, ${cost.voice.billedMinutes} faturalı dk)`,
          "Hesap kesilmedi; bu yalnızca bir görünürlük uyarısıdır.",
        ].join("\n"),
      }),
  };
}

/** Month-to-date check; runs each action at most once per restaurant per month. */
export class CostGuard {
  constructor(
    private readonly db: Db,
    private readonly costs: CostService,
    private readonly actions: CostThresholdAction[],
  ) {}

  async run(now = new Date()) {
    const window = monthWindow(now);
    const over = (await this.costs.allCosts(window)).filter((c) => c.overThreshold);
    const fired: Array<{ restaurantId: string; action: string }> = [];
    for (const cost of over)
      for (const action of this.actions) {
        const claimed = await this.db.query(
          `INSERT INTO cost_alerts(restaurant_id,period,action,total_usd,threshold_usd) VALUES($1,$2,$3,$4,$5)
           ON CONFLICT (restaurant_id,period,action) DO NOTHING RETURNING restaurant_id`,
          [cost.restaurantId, cost.period, action.name, cost.totalUsd, cost.thresholdUsd],
        );
        if (claimed.rows.length === 0) continue;
        await action.run(cost);
        fired.push({ restaurantId: cost.restaurantId, action: action.name });
      }
    return { period: window.period, overThreshold: over.length, fired };
  }
}

export function costRatesFromEnv(env: {
  SUBSCRIPTION_PRICE_USD?: number;
  COST_ALERT_THRESHOLD_RATIO?: number;
  COST_TWILIO_PER_MINUTE?: number;
  COST_STT_PER_MINUTE?: number;
  COST_TTS_PER_MINUTE?: number;
}): CostRates {
  return {
    subscriptionPriceUsd: env.SUBSCRIPTION_PRICE_USD ?? 199,
    thresholdRatio: env.COST_ALERT_THRESHOLD_RATIO ?? 0.6,
    twilioPerMinute: env.COST_TWILIO_PER_MINUTE ?? 0.0125,
    sttPerMinute: env.COST_STT_PER_MINUTE ?? 0.0077,
    ttsPerMinute: env.COST_TTS_PER_MINUTE ?? 0.01,
  };
}
