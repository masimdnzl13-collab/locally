import { afterEach, describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { createApp } from "../src/app.js";
import { loadEnv } from "../src/config/env.js";
import { createAlertNotifier, type AdminAlert, type AlertNotifier } from "../src/alerts/notifier.js";
import { TelephonyErrorMonitor } from "../src/alerts/telephony-monitor.js";
import { aiCostUsd, CostGuard, CostService, monthWindow, notifyAdminAction } from "../src/services/cost-service.js";
import type { VoiceRuntime } from "../src/voice/runtime.js";

const secret = "test-secret-that-is-long-enough-for-security";
const env = loadEnv({
  APP_ENV: "test",
  DATABASE_URL: "postgres://localhost/test",
  JWT_SECRET: secret,
  CORS_ORIGINS: "http://localhost:5173",
  LOG_LEVEL: "fatal",
});
const R1 = "11111111-1111-4111-8111-111111111111";
const R2 = "22222222-2222-4222-8222-222222222222";
const rates = { subscriptionPriceUsd: 199, thresholdRatio: 0.6, twilioPerMinute: 0.01, sttPerMinute: 0.005, ttsPerMinute: 0.005 };

function recorder() {
  const sent: AdminAlert[] = [];
  const notifier: AlertNotifier = { send: async (a) => { sent.push(a); } };
  return { sent, notifier };
}
/** Minimal Db stub: answers by matching the SQL text. */
function fakeDb(data: {
  usage?: Record<string, Array<{ model: string; input_tokens: number; output_tokens: number; unknown_input: number; unknown_output: number; known_cost: number }>>;
  minutes?: Record<string, number>;
  alerts?: Set<string>;
}) {
  const alerts = data.alerts ?? new Set<string>();
  const query = async (text: string, values: unknown[] = []) => {
    if (text.includes("FROM restaurants")) {
      const all = [{ id: R1, name: "Luigi's" }, { id: R2, name: "Taco Bay" }];
      const ids = values[0] as string[] | undefined;
      return { rows: ids ? all.filter((r) => ids.includes(r.id)) : all };
    }
    if (text.includes("FROM ai_usage")) return { rows: data.usage?.[values[0] as string] ?? [] };
    if (text.includes("FROM calls") && text.includes("billed_minutes"))
      return { rows: [{ calls: 3, billed_minutes: data.minutes?.[values[0] as string] ?? 0 }] };
    if (text.includes("COUNT(*) AS n")) return { rows: [{ n: text.includes("FROM calls") ? 7 : 2 }] };
    if (text.includes("INSERT INTO cost_alerts")) {
      const key = `${values[0]}:${values[1]}:${values[2]}`;
      if (alerts.has(key)) return { rows: [] };
      alerts.add(key);
      return { rows: [{ restaurant_id: values[0] }] };
    }
    return { rows: [] };
  };
  return { query, connect: async () => ({}), end: async () => {} } as never;
}

describe("AI cost pricing", () => {
  it("prices known models per million tokens and falls back conservatively", () => {
    expect(aiCostUsd("claude-opus-5", 1_000_000, 1_000_000)).toBe(30);
    expect(aiCostUsd("claude-haiku-4-5", 1_000_000, 0)).toBe(1);
    expect(aiCostUsd("anthropic.claude-sonnet-5", 0, 1_000_000)).toBe(10);
    expect(aiCostUsd("some-future-model", 1_000_000, 0)).toBe(5);
    expect(aiCostUsd("mock", 1_000_000, 1_000_000)).toBe(0);
  });
});

describe("CostService / CostGuard", () => {
  const usage = {
    // $30 of Opus 5 tokens + $50 already estimated on the row
    [R1]: [{ model: "claude-opus-5", input_tokens: 2_000_000, output_tokens: 1_000_000, unknown_input: 1_000_000, unknown_output: 1_000_000, known_cost: 50 }],
  };
  it("adds Claude tokens and voice minutes and compares against price x ratio", async () => {
    const costs = new CostService(fakeDb({ usage, minutes: { [R1]: 3000 } }), rates);
    const cost = await costs.restaurantCost({ id: R1, name: "Luigi's" }, monthWindow(new Date("2026-10-15T12:00:00Z")));
    expect(cost.period).toBe("2026-10");
    expect(cost.ai.usd).toBe(80);
    expect(cost.voice.usd).toBe(60); // 3000 min x $0.02
    expect(cost.totalUsd).toBe(140);
    expect(cost.thresholdUsd).toBe(119.4);
    expect(cost.overThreshold).toBe(true);
  });
  it("fires each action once per restaurant per month and leaves others alone", async () => {
    const { sent, notifier } = recorder();
    const db = fakeDb({ usage, minutes: { [R1]: 3000, [R2]: 10 } });
    const guard = new CostGuard(db, new CostService(db, rates), [notifyAdminAction(notifier)]);
    const first = await guard.run(new Date("2026-10-15T12:00:00Z"));
    expect(first.fired).toEqual([{ restaurantId: R1, action: "notify_admin" }]);
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toContain("Luigi's");
    expect(sent[0].text).toContain("$140.00");
    const again = await guard.run(new Date("2026-10-20T12:00:00Z"));
    expect(again.fired).toEqual([]);
    expect(sent).toHaveLength(1);
  });
});

describe("TelephonyErrorMonitor", () => {
  it("alerts on the 4th failure inside 5 minutes, then honours the cooldown", () => {
    const { sent, notifier } = recorder();
    let now = 0;
    const monitor = new TelephonyErrorMonitor(notifier, { maxErrors: 3, windowMs: 300_000, cooldownMs: 900_000 }, () => now);
    for (let i = 0; i < 3; i++) monitor.record({ route: "/incoming", statusCode: 500 });
    expect(sent).toHaveLength(0);
    monitor.record({ route: "/incoming", statusCode: 500 });
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toBe("Tideline telephony hata veriyor");
    now = 60_000;
    monitor.record({ route: "/status", statusCode: 502 });
    expect(sent).toHaveLength(1); // cooldown
    now = 1_000_000;
    monitor.record({ route: "/status", statusCode: 500 });
    expect(monitor.recentFailures).toBe(1); // old ones fell out of the window
    expect(sent).toHaveLength(1);
  });
  it("counts 5xx from the Twilio routes but not 4xx", async () => {
    const { sent, notifier } = recorder();
    const voice = {
      repo: {
        resolveActivePhone: async (phone: string) => {
          if (phone === "+15550000000") throw new Error("db down");
          return undefined;
        },
      },
      telephony: {},
      manager: {},
    } as unknown as VoiceRuntime;
    const app = createApp(env, fakeDb({}), { voice, notifier });
    await app.ready();
    const hit = (to: string) =>
      app.inject({ method: "POST", url: "/api/v1/telephony/twilio/incoming", payload: { To: to, CallSid: "CA1" } });
    for (let i = 0; i < 5; i++) expect((await hit("+15551112222")).statusCode).toBe(404);
    expect(sent).toHaveLength(0);
    for (let i = 0; i < 4; i++) expect((await hit("+15550000000")).statusCode).toBe(500);
    await new Promise((r) => setImmediate(r));
    expect(sent).toHaveLength(1);
    expect(sent[0].text).toContain("/api/v1/telephony/twilio/incoming");
    // Non-telephony 5xx never feed the counter.
    await app.close();
  });
});

describe("alert routing", () => {
  const log = { warn: () => {}, error: () => {} };
  it("prefers the Slack webhook, then Resend email, else logs", async () => {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)) });
      return new Response(null, { status: 200 });
    }) as typeof fetch;
    const base = { APP_ENV: "production" as const, ALERT_EMAIL_TO: "a@b.co", ALERT_EMAIL_FROM: "x@y.co", RESEND_API_KEY: "re_1" };
    await createAlertNotifier({ ...base, ALERT_WEBHOOK_URL: "https://hooks.slack.test/x" }, log, fetchImpl).send({ subject: "S", text: "T" });
    await createAlertNotifier(base, log, fetchImpl).send({ subject: "S", text: "T" });
    await createAlertNotifier({ APP_ENV: "production" }, log, fetchImpl).send({ subject: "S", text: "T" });
    expect(calls.map((c) => c.url)).toEqual(["https://hooks.slack.test/x", "https://api.resend.com/emails"]);
    expect(calls[0].body.text).toContain("*S*");
    expect(calls[1].body).toMatchObject({ to: ["a@b.co"], subject: "S", text: "T" });
  });
  it("never throws when delivery fails", async () => {
    const fetchImpl = (async () => new Response(null, { status: 500 })) as unknown as typeof fetch;
    await expect(
      createAlertNotifier({ APP_ENV: "test", ALERT_WEBHOOK_URL: "https://hooks.slack.test/x" }, log, fetchImpl).send({ subject: "S", text: "T" }),
    ).resolves.toBeUndefined();
  });
});

describe("internal service endpoints", () => {
  const apps: Array<{ close: () => Promise<unknown> }> = [];
  afterEach(async () => { await Promise.all(apps.splice(0).map((a) => a.close())); });
  const token = (aud: string, iss = "locally") =>
    new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setIssuer(iss).setAudience(aud).setIssuedAt().setExpirationTime("60s").sign(new TextEncoder().encode(secret));
  async function start() {
    const app = createApp(env, fakeDb({ minutes: { [R1]: 10 } }), { voice: {} as VoiceRuntime, notifier: recorder().notifier });
    apps.push(app);
    await app.ready();
    return app;
  }
  it("rejects missing, wrong-audience, and bearer-style credentials", async () => {
    const app = await start();
    const url = `/api/v1/internal/restaurants/activity?ids=${R1}`;
    expect((await app.inject({ url })).statusCode).toBe(401);
    expect((await app.inject({ url, headers: { "x-service-token": await token("tideline-sso") } })).statusCode).toBe(401);
    expect((await app.inject({ url, headers: { "x-service-token": await token("tideline-service", "evil") } })).statusCode).toBe(401);
  });
  it("returns 7-day activity and month cost for the requested restaurants", async () => {
    const app = await start();
    const res = await app.inject({
      url: `/api/v1/internal/restaurants/activity?ids=${R1},${R1}`,
      headers: { "x-service-token": await token("tideline-service") },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      thresholdUsd: 119.4,
      restaurants: [{ restaurantId: R1, name: "Luigi's", calls7d: 7, orders7d: 2, costOverThreshold: false }],
    });
    const bad = await app.inject({
      url: "/api/v1/internal/restaurants/activity?ids=not-a-uuid",
      headers: { "x-service-token": await token("tideline-service") },
    });
    expect(bad.statusCode).toBe(400);
  });
  it("lists costs for every active restaurant", async () => {
    const app = await start();
    const res = await app.inject({ url: "/api/v1/internal/costs?period=day", headers: { "x-service-token": await token("tideline-service") } });
    expect(res.statusCode).toBe(200);
    expect(res.json().restaurants).toHaveLength(2);
  });
});
