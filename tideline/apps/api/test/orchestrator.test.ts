import { describe, expect, it } from "vitest";
import { AIOrchestrator } from "../src/ai/orchestrator.js";
import { ActionRegistry } from "../src/ai/action-registry.js";
import { DeterministicMockAIProvider } from "../src/ai/mock-provider.js";
import { RestaurantContextService } from "../src/ai/context-service.js";
import { ReceptionistInstructionBuilder } from "../src/ai/instructions.js";
import { ResponseGenerator } from "../src/ai/response-generator.js";
import { emptyState, type AIProvider, type AIRequest, type ConversationState, type ProviderMessage, type ToolDecision } from "../src/ai/types.js";
import type { Db } from "../src/database/db.js";

const restaurantId = "00000000-0000-0000-0000-000000000001";
const itemId = "00000000-0000-0000-0000-000000000002";
const brain = {
  restaurantName: "Luigi's Trattoria",
  timezone: "America/New_York",
  greeting: {},
  hours: { weekly: [{ weekday: 1, startTime: "11:00", endTime: "22:00" }] },
  menu: [{ id: itemId, name: "Margherita Pizza", priceCents: 1400, allergens: ["gluten", "dairy"] }],
  policies: { parking: "Free lot behind the building" },
  seasonalStatus: "ACTIVE",
  seasonalClosedMessage: {},
  humanTransfer: { enabled: true, destination: "+15550001111" },
};
function fakeRepo() {
  const db = { query: async () => ({ rows: [] }), connect: async () => ({ query: async () => ({ rows: [] }), release: () => {} }), end: async () => {} } as unknown as Db;
  const messages: ProviderMessage[] = [];
  let state: ConversationState = emptyState();
  const toolCalls: Array<{ name: string; status: string }> = [];
  const repo = {
    db,
    callForRestaurant: async () => ({ id: "session-1", restaurant_id: restaurantId }),
    ensureConversation: async () => ({ id: "conv-1", restaurantId, callSessionId: "session-1", state, status: "ACTIVE" }),
    brain: async () => brain,
    startTurn: async () => ({ id: `turn-${messages.length}`, number: messages.length + 1 }),
    classifyTurn: async () => {},
    addMessage: async (_c: string, role: ProviderMessage["role"], content: string) => { messages.push({ role, content }); },
    messages: async () => [...messages],
    toolCall: async (x: { name: string; status: string }) => { toolCalls.push({ name: x.name, status: x.status }); },
    update: async (_c: unknown, next: ConversationState) => { state = JSON.parse(JSON.stringify(next)); },
    finishTurn: async () => {},
    usage: async () => {},
    cancelConfirmation: async () => {},
  };
  return { repo, messages, toolCalls, getState: () => state };
}
/** Replays a fixed script of tool decisions and replies, recording the prompts it was given. */
class ScriptedProvider implements AIProvider {
  readonly name = "scripted";
  prompts: string[] = [];
  constructor(private decisions: ToolDecision[], private replies: string[]) {}
  async detectIntent() { return { intent: "RESERVATION" as const, confidence: 0.95, language: "EN" as const }; }
  async decideToolCall(input: AIRequest) { this.prompts.push(input.instructions); return this.decisions.shift() ?? null; }
  async generateResponse() { return { text: this.replies.shift() ?? "", usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, model: "scripted" } }; }
  async generateStructuredOutput<T>(): Promise<T> { throw new Error("unused"); }
}
const reservation = { guestName: "Ana Lopez", guestPhone: "+15551234567", partySize: 2, date: "2026-09-26", time: "19:30" };
function orchestrator(provider: AIProvider, repo: ReturnType<typeof fakeRepo>["repo"], executed: unknown[] = []) {
  const confirmations = {
    prepare: async () => ({ id: "11111111-1111-4111-8111-111111111111", state: "READY_FOR_CONFIRMATION" as const }),
    confirm: async (_r: string, _id: string, payload: unknown) => { executed.push({ confirmed: payload }); return { confirmed: true }; },
  };
  const reservations = {
    createReservation: async (_c: unknown, input: unknown, confirmationId: string) => {
      executed.push({ created: input, confirmationId });
      return { success: true, reservation: { confirmation_code: "RSV-4821" } };
    },
    availability: { check: async () => ({ available: true }) },
  };
  // Mutations go through the idempotency claim, which needs a transaction-capable db.
  const claims = new Map<string, unknown>();
  const txQuery = async (sql: string, values: unknown[] = []) => {
    if (sql.startsWith("INSERT INTO action_idempotency")) { const key = String(values[2]); if (claims.has(key)) return { rows: [] }; claims.set(key, true); return { rows: [{ response: null, status: "PROCESSING", action: values[1] }] }; }
    return { rows: [] };
  };
  const db = { query: txQuery, connect: async () => ({ query: txQuery, release: () => {} }), end: async () => {} } as unknown as Db;
  const actions = new ActionRegistry(db, reservations as never);
  return new AIOrchestrator(provider, repo as never, new RestaurantContextService(), actions, new ReceptionistInstructionBuilder(), new ResponseGenerator(), 0.7, confirmations as never);
}

describe("AIOrchestrator", () => {
  it("proposes a reservation, waits for the caller's yes, then books it with a server-issued confirmation", async () => {
    const { repo, getState, toolCalls } = fakeRepo();
    const executed: unknown[] = [];
    const provider = new ScriptedProvider(
      [{ name: "create_reservation", arguments: reservation }, null, { name: "confirm_pending_action", arguments: {} }, null],
      ["Two people Saturday at 7:30 for Ana Lopez, shall I book it?", "You're booked, confirmation RSV-4821."],
    );
    const ai = orchestrator(provider, repo, executed);
    const first = await ai.processTurn({ requestId: "r1", restaurantId, callSessionId: "session-1", transcript: "Book Saturday 7:30 for two, Ana Lopez", callerPhone: "+15551234567" });
    expect(first.assistantText).toContain("shall I book it");
    expect(executed).toHaveLength(0);
    expect(getState().pendingAction).toMatchObject({ tool: "create_reservation", confirmationId: "11111111-1111-4111-8111-111111111111" });
    expect(provider.prompts[0]).toContain("Luigi's Trattoria");
    expect(provider.prompts[0]).not.toContain("phone receptionist for Restaurant.");
    expect(provider.prompts[0]).toContain("Caller ID: +15551234567");

    const second = await ai.processTurn({ requestId: "r2", restaurantId, callSessionId: "session-1", transcript: "Yes please" });
    expect(second.assistantText).toContain("RSV-4821");
    expect(executed).toEqual([
      { confirmed: expect.objectContaining({ guestName: "Ana Lopez", partySize: 2 }) },
      { created: expect.objectContaining({ guestName: "Ana Lopez" }), confirmationId: "11111111-1111-4111-8111-111111111111" },
    ]);
    expect(getState().pendingAction).toBeUndefined();
    expect(toolCalls.map((t) => `${t.name}:${t.status}`)).toEqual(["create_reservation:SUCCESS", "confirm_pending_action:SUCCESS"]);
  });
  it("rejects confirming when nothing is pending and never books", async () => {
    const { repo } = fakeRepo();
    const executed: unknown[] = [];
    const provider = new ScriptedProvider([{ name: "confirm_pending_action", arguments: {} }, null], [""]);
    const result = await orchestrator(provider, repo, executed).processTurn({ requestId: "r", restaurantId, callSessionId: "session-1", transcript: "yes" });
    expect(executed).toHaveLength(0);
    expect(result.toolCall?.result).toMatchObject({ success: false, error: { code: "NO_PENDING_ACTION" } });
  });
  it("feeds invalid proposals back to the model instead of preparing them", async () => {
    const { repo, getState, messages } = fakeRepo();
    const provider = new ScriptedProvider([{ name: "create_reservation", arguments: { ...reservation, date: "saturday" } }, null], ["What date exactly?"]);
    await orchestrator(provider, repo).processTurn({ requestId: "r", restaurantId, callSessionId: "session-1", transcript: "Saturday for two" });
    expect(getState().pendingAction).toBeUndefined();
    expect(messages.find((m) => m.role === "TOOL")?.content).toContain("INVALID_ACTION_INPUT");
  });
  it("returns the transfer destination when the caller asks for a person", async () => {
    const { repo } = fakeRepo();
    const provider = new ScriptedProvider([{ name: "request_human_transfer", arguments: {} }], ["Connecting you now."]);
    const result = await orchestrator(provider, repo).processTurn({ requestId: "r", restaurantId, callSessionId: "session-1", transcript: "Can I talk to a person?" });
    expect(result.transferTo).toBe("+15550001111");
  });
  it("answers allergen questions by dish name with the deterministic mock provider", async () => {
    const { repo } = fakeRepo();
    const result = await orchestrator(new DeterministicMockAIProvider(), repo).processTurn({ requestId: "r", restaurantId, callSessionId: "session-1", transcript: "Is there gluten, allergy info for Margherita Pizza?" });
    expect(result.toolCall?.name).toBe("get_allergen_info");
    expect(result.toolCall?.result).toMatchObject({ state: "KNOWN", item: { id: itemId } });
    expect(result.assistantText).toContain("gluten");
  });
});
