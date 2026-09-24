/**
 * End-to-end simulated phone call against a real PostgreSQL (row-level security
 * enforced through a non-superuser role). Skipped unless INTEGRATION_DATABASE_URL
 * points at a disposable database whose user may create roles, e.g.
 *   docker run -d -p 5433:5432 -e POSTGRES_PASSWORD=pw postgres:16-alpine
 *   INTEGRATION_DATABASE_URL=postgresql://postgres:pw@localhost:5433/postgres npx vitest run test/call-flow.integration.test.ts
 */
import { randomUUID } from "node:crypto";
import { DateTime } from "luxon";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { loadEnv } from "../src/config/env.js";
import { createDb } from "../src/database/db.js";
import { migrate } from "../src/database/migrate.js";
import { AIOrchestrator } from "../src/ai/orchestrator.js";
import { ConversationRepository } from "../src/ai/conversation-repository.js";
import { VoiceRepository } from "../src/repositories/voice-repository.js";
import { VoiceSessionManager } from "../src/voice/session-manager.js";
import { OrchestratorVoiceEngine } from "../src/voice/orchestrator-engine.js";
import { MockSttProvider } from "../src/voice/mock-providers.js";
import { TestTelephonyProvider } from "../src/voice/twilio-provider.js";
import type { AIProvider, AIRequest, ToolDecision } from "../src/ai/types.js";

const url = process.env.INTEGRATION_DATABASE_URL;
const restaurantId = randomUUID();
const categoryId = randomUUID();
const pizzaId = randomUUID();
const phoneNumber = `+1555${Math.floor(1000000 + Math.random() * 8999999)}`;
const saturday = DateTime.now().setZone("America/New_York").plus({ days: 3 }).toISODate()!;

/** Stands in for Claude: fixed tool decisions per caller utterance, real everything else. */
class ScriptedCaller implements AIProvider {
  readonly name = "scripted";
  private script: Record<string, ToolDecision[]> = {
    "Table for two at 7:30 pm, name Ana Lopez": [
      { name: "create_reservation", arguments: { guestName: "Ana Lopez", guestPhone: "+15551234567", partySize: 2, date: saturday, time: "19:30" } },
    ],
    "Yes, book it": [{ name: "confirm_pending_action", arguments: {} }],
    "Quiero pedir dos pizzas margherita para recoger": [
      { name: "calculate_order", arguments: { customerName: "Luis", customerPhone: "+15557654321", orderType: "PICKUP", items: [{ menuItemId: pizzaId, quantity: 2, modifiers: [] }] } },
      { name: "create_order", arguments: { customerName: "Luis", customerPhone: "+15557654321", orderType: "PICKUP", items: [{ menuItemId: pizzaId, quantity: 2, modifiers: [] }] } },
    ],
    "Sí, confírmelo": [{ name: "confirm_pending_action", arguments: {} }],
  };
  private current: ToolDecision[] = [];
  async detectIntent({ text }: { text: string }) {
    const es = /[íé]|quiero/i.test(text);
    return { intent: (/pedir|pizza|confírmelo/i.test(text) ? "ORDER" : "RESERVATION") as "ORDER", confidence: 0.9, language: (es ? "ES" : "EN") as "ES" };
  }
  async decideToolCall(input: AIRequest) {
    const last = input.messages.at(-1)!;
    if (last.role === "USER") this.current = [...(this.script[last.content] ?? [])];
    return this.current.shift() ?? null;
  }
  async generateResponse(input: AIRequest) {
    const last = input.messages.at(-1)!;
    return { text: `ok: ${last.content}`, usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15, model: "scripted" } };
  }
  async generateStructuredOutput<T>(): Promise<T> { throw new Error("unused"); }
  drainUsage() { return { inputTokens: 10, outputTokens: 5, totalTokens: 15, model: "scripted" }; }
}

describe.skipIf(!url)("simulated phone call on PostgreSQL", () => {
  const admin = url ? createDb(url) : undefined!;
  let app: ReturnType<typeof createApp>;
  let appDb: ReturnType<typeof createDb>;
  const spoken: string[] = [];
  beforeAll(async () => {
    await migrate(admin);
    const role = "tideline_app";
    await admin.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='${role}') THEN CREATE ROLE ${role} LOGIN PASSWORD 'app-pw' NOSUPERUSER NOBYPASSRLS; END IF; END $$`);
    await admin.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO ${role}`);
    await admin.query(`INSERT INTO restaurants(id,name,slug,status,timezone) VALUES($1,'Luigi''s Trattoria',$2,'ACTIVE','America/New_York')`, [restaurantId, `luigis-${restaurantId.slice(0, 8)}`]);
    await admin.query(`INSERT INTO restaurant_brain(restaurant_id) VALUES($1)`, [restaurantId]);
    for (let weekday = 0; weekday < 7; weekday++)
      await admin.query(`INSERT INTO business_hours(id,restaurant_id,weekday,start_time,end_time) VALUES($1,$2,$3,'11:00','22:00')`, [randomUUID(), restaurantId, weekday]);
    await admin.query(`INSERT INTO menu_categories(id,restaurant_id,name) VALUES($1,$2,'Pizza')`, [categoryId, restaurantId]);
    await admin.query(`INSERT INTO menu_items(id,restaurant_id,category_id,name,price_cents,allergens) VALUES($1,$2,$3,'Margherita Pizza',1400,'["gluten","dairy"]')`, [pizzaId, restaurantId, categoryId]);
    await admin.query(`INSERT INTO reservation_settings(restaurant_id,accept_reservations) VALUES($1,true)`, [restaurantId]);
    await admin.query(`INSERT INTO order_settings(restaurant_id,accept_orders,tax_basis_points) VALUES($1,true,800)`, [restaurantId]);
    await admin.query(`INSERT INTO restaurant_phone_numbers(id,restaurant_id,phone_number,active) VALUES($1,$2,$3,true)`, [randomUUID(), restaurantId, phoneNumber]);
    const appUrl = new URL(url!);
    appUrl.username = role;
    appUrl.password = "app-pw";
    appDb = createDb(appUrl.toString());
    const env = loadEnv({ APP_ENV: "test", DATABASE_URL: appUrl.toString(), JWT_SECRET: "integration-secret-that-is-long-enough", CORS_ORIGINS: "http://localhost:5173", LOG_LEVEL: "fatal", TELEPHONY_MODE: "test" });
    const repo = new VoiceRepository(appDb);
    const telephony = new TestTelephonyProvider();
    const orchestrator = new AIOrchestrator(new ScriptedCaller(), new ConversationRepository(appDb));
    const manager = new VoiceSessionManager(repo, new MockSttProvider(), { synthesize: async ({ text }) => { spoken.push(text); return { buffer: Buffer.from(text), encoding: "mulaw", sampleRateHz: 8000, channels: 1 }; } }, new OrchestratorVoiceEngine(orchestrator), telephony, env, async () => {});
    app = createApp(env, appDb, { voice: { repo, telephony, manager } });
    await app.ready();
  }, 60000);
  afterAll(async () => {
    await app?.close();
    await appDb?.end();
    await admin?.end();
  });

  it("takes a reservation and an order over a call and shows them in the dashboard", async () => {
    const incoming = await app.inject({
      method: "POST",
      url: "/api/v1/telephony/twilio/incoming",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: new URLSearchParams({ CallSid: `CA${randomUUID().replace(/-/g, "")}`, To: phoneNumber, From: "+15551234567" }).toString(),
    });
    expect(incoming.statusCode).toBe(200);
    expect(incoming.body).toContain("Thank you for calling Luigi&apos;s Trattoria");
    const sessionId = /name="sessionId" value="([^"]+)"/.exec(incoming.body)![1];
    const say = async (transcript: string) => {
      const r = await app.inject({ method: "POST", url: `/api/v1/telephony/test/sessions/${sessionId}/events`, payload: { type: "transcript", transcript } });
      expect(r.statusCode).toBe(204);
    };
    await say("Table for two at 7:30 pm, name Ana Lopez");
    expect(spoken.at(-1)).toContain("READY_FOR_CONFIRMATION");
    await say("Yes, book it");
    expect(spoken.at(-1)).toContain("confirmationCode");
    await say("Quiero pedir dos pizzas margherita para recoger");
    await say("Sí, confírmelo");
    expect(spoken.at(-1)).toContain("orderNumber");
    await app.inject({ method: "POST", url: `/api/v1/telephony/test/sessions/${sessionId}/events`, payload: { type: "stop" } });

    const reservation = (await admin.query("SELECT guest_name,party_size,reservation_date::text,reservation_time::text,source,conversation_id FROM reservations WHERE restaurant_id=$1", [restaurantId])).rows;
    expect(reservation).toEqual([expect.objectContaining({ guest_name: "Ana Lopez", party_size: 2, reservation_date: saturday, reservation_time: "19:30:00", source: "AI_PHONE" })]);
    expect(reservation[0].conversation_id).toBeTruthy();
    const order = (await admin.query("SELECT customer_name,order_type,subtotal_cents,tax_cents,total_cents,source FROM orders WHERE restaurant_id=$1", [restaurantId])).rows;
    expect(order).toEqual([{ customer_name: "Luis", order_type: "PICKUP", subtotal_cents: 2800, tax_cents: 224, total_cents: 3024, source: "AI_PHONE" }]);
    const confirmations = (await admin.query("SELECT action,status FROM action_confirmations WHERE restaurant_id=$1 ORDER BY created_at", [restaurantId])).rows;
    expect(confirmations).toEqual([{ action: "CREATE_RESERVATION", status: "CONSUMED" }, { action: "CREATE_ORDER", status: "CONSUMED" }]);
    const call = (await admin.query("SELECT status,language,initial_intent,ended_at FROM calls WHERE restaurant_id=$1", [restaurantId])).rows[0];
    expect(call).toMatchObject({ status: "COMPLETED", language: "es", initial_intent: "RESERVATION" });
    expect(call.ended_at).toBeTruthy();
    const turns = (await admin.query("SELECT t.intent,t.language FROM conversation_turns t JOIN conversations c ON c.id=t.conversation_id WHERE c.restaurant_id=$1 ORDER BY t.turn_number", [restaurantId])).rows;
    expect(turns.map((t) => `${t.intent}/${t.language}`)).toEqual(["RESERVATION/EN", "RESERVATION/EN", "ORDER/ES", "ORDER/ES"]);
    expect((await admin.query("SELECT count(*)::int n FROM ai_usage WHERE restaurant_id=$1", [restaurantId])).rows[0].n).toBe(4);
    expect((await admin.query("SELECT count(*)::int n FROM conversation_tool_calls WHERE restaurant_id=$1 AND status='SUCCESS'", [restaurantId])).rows[0].n).toBe(5);

    // Dashboard: an owner sees the call, the reservation and the order.
    const account = (await app.inject({ method: "POST", url: "/api/v1/auth/register", payload: { email: `owner-${restaurantId}@example.test`, password: "SecurePassword123!" } })).json() as { token: string; user: { id: string } };
    await admin.query("INSERT INTO restaurant_memberships(user_id,restaurant_id,role) VALUES($1,$2,'OWNER')", [account.user.id, restaurantId]);
    const get = async (path: string) => {
      const r = await app.inject({ method: "GET", url: `/api/v1/restaurants/${restaurantId}/${path}`, headers: { authorization: `Bearer ${account.token}` } });
      expect(r.statusCode).toBe(200);
      return JSON.stringify(r.json());
    };
    expect(await get("reservations")).toContain("Ana Lopez");
    expect(await get("orders")).toContain("Luis");
    expect(await get("calls")).toContain("COMPLETED");
  }, 60000);
});
