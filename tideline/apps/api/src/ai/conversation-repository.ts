import { randomUUID } from "node:crypto";
import type { Db } from "../database/db.js";
import {
  emptyState,
  type ConversationState,
  type Intent,
  type Language,
  type ProviderMessage,
} from "./types.js";
import type { Brain } from "./context-service.js";
export type Conversation = {
  id: string;
  restaurantId: string;
  callSessionId: string;
  language?: Language;
  state: ConversationState;
  status: string;
};
export class ConversationRepository {
  constructor(public readonly db: Db) {}
  async callForRestaurant(restaurantId: string, callId: string) {
    return (
      await this.db.query<{ id: string; restaurant_id: string }>(
        "SELECT id,restaurant_id FROM call_sessions WHERE id=$1 AND restaurant_id=$2",
        [callId, restaurantId],
      )
    ).rows[0];
  }
  async createCall(restaurantId: string, providerCallId: string) {
    const id = randomUUID();
    await this.db.query(
      "INSERT INTO call_sessions(id,restaurant_id,provider_call_id) VALUES($1,$2,$3)",
      [id, restaurantId, providerCallId],
    );
    return id;
  }
  async conversation(
    restaurantId: string,
    callId: string,
  ): Promise<Conversation | undefined> {
    const r = await this.db.query<{
      id: string;
      restaurant_id: string;
      call_session_id: string;
      language: Language;
      state: ConversationState;
      status: string;
    }>(
      "SELECT id,restaurant_id,call_session_id,language,state,status FROM conversations WHERE restaurant_id=$1 AND call_session_id=$2",
      [restaurantId, callId],
    );
    const x = r.rows[0];
    return (
      x && {
        id: x.id,
        restaurantId: x.restaurant_id,
        callSessionId: x.call_session_id,
        language: x.language,
        state: x.state ?? emptyState(),
        status: x.status,
      }
    );
  }
  async ensureConversation(restaurantId: string, callId: string) {
    let c = await this.conversation(restaurantId, callId);
    if (c) return c;
    const id = randomUUID();
    await this.db.query(
      "INSERT INTO conversations(id,restaurant_id,call_session_id,state) VALUES($1,$2,$3,$4)",
      [id, restaurantId, callId, JSON.stringify(emptyState())],
    );
    return (await this.conversation(restaurantId, callId))!;
  }
  async brain(restaurantId: string): Promise<Brain | undefined> {
    const base = (await this.db.query<{ greeting: Record<string,string>; seasonal_status: string; seasonal_closed_message: Record<string,string>; ai_instructions?: string }>(
      'SELECT greeting,"seasonal_status",seasonal_closed_message,ai_instructions FROM restaurant_brain WHERE restaurant_id=$1', [restaurantId])).rows[0];
    const [restaurant, hours, categories, items, policies, settings, closures] = await Promise.all([
      this.db.query<{ name: string; timezone: string }>('SELECT name,timezone FROM restaurants WHERE id=$1',[restaurantId]),
      this.db.query('SELECT weekday,start_time::text "startTime",end_time::text "endTime" FROM business_hours WHERE restaurant_id=$1 ORDER BY weekday,start_time',[restaurantId]),
      this.db.query('SELECT id,name,description,display_order "displayOrder" FROM menu_categories WHERE restaurant_id=$1 AND active=true ORDER BY display_order,name',[restaurantId]),
      this.db.query('SELECT id,category_id "categoryId",name,description,price_cents "priceCents",active,available,unavailable_reason "unavailableReason",dietary_information "dietaryInformation",allergens,display_order "displayOrder" FROM menu_items WHERE restaurant_id=$1 AND active=true ORDER BY display_order,name',[restaurantId]),
      this.db.query('SELECT policy_type "type",title,description FROM restaurant_policies WHERE restaurant_id=$1 AND active=true ORDER BY policy_type,title',[restaurantId]),
      this.db.query('SELECT parking,directions,reservation_rules "reservationRules",escalation,ai_configuration "aiConfiguration" FROM restaurant_settings WHERE restaurant_id=$1',[restaurantId]),
      this.db.query('SELECT closure_date "closureDate",start_time::text "startTime",end_time::text "endTime",reason FROM special_closures WHERE restaurant_id=$1 AND active=true ORDER BY closure_date,start_time',[restaurantId]),
    ]);
    // The restaurant itself must exist; its restaurant_brain row is optional. Nothing creates that
    // row for self-serve restaurants (provisioning, POST /restaurants), and treating "no row" as
    // "no Brain" failed every call on the caller's first sentence. Missing row = in season, no
    // custom greeting/closed message; hours, menu and policies come from their own tables.
    if (!restaurant.rows[0]) return undefined;
    const brainRow = base ?? { greeting: {}, seasonal_status: "ACTIVE", seasonal_closed_message: {}, ai_instructions: undefined };
    const setting = settings.rows[0] ?? {};
    return { restaurantName: restaurant.rows[0]?.name, timezone: restaurant.rows[0]?.timezone, greeting: brainRow.greeting, hours: { weekly: hours.rows, closures: closures.rows }, menu: items.rows.map((item) => ({ ...item, category: categories.rows.find((c: { id: string })=>c.id===item.categoryId)?.name })), policies: { restaurant: policies.rows, ...setting }, seasonalStatus: brainRow.seasonal_status, seasonalClosedMessage: brainRow.seasonal_closed_message, humanTransfer: setting.escalation ?? {}, aiInstructions: setting.aiConfiguration?.instructions ?? brainRow.ai_instructions };
  }
  async messages(conversationId: string): Promise<ProviderMessage[]> {
    return (
      await this.db.query<{ role: ProviderMessage["role"]; content: string }>(
        "SELECT role,content FROM conversation_messages WHERE conversation_id=$1 ORDER BY sequence",
        [conversationId],
      )
    ).rows;
  }
  async addMessage(
    conversationId: string,
    role: ProviderMessage["role"],
    content: string,
  ) {
    const seq = (
      await this.db.query<{ n: number }>(
        "SELECT COALESCE(MAX(sequence),0)+1 n FROM conversation_messages WHERE conversation_id=$1",
        [conversationId],
      )
    ).rows[0].n;
    await this.db.query(
      "INSERT INTO conversation_messages(id,conversation_id,role,content,sequence) VALUES($1,$2,$3,$4,$5)",
      [randomUUID(), conversationId, role, content, seq],
    );
  }
  async startTurn(
    conversationId: string,
    transcript: string,
    intent: Intent,
    confidence: number,
    reason?: string,
    language?: Language,
  ) {
    const n = (
        await this.db.query<{ n: number }>(
          "SELECT COALESCE(MAX(turn_number),0)+1 n FROM conversation_turns WHERE conversation_id=$1",
          [conversationId],
        )
      ).rows[0].n,
      id = randomUUID();
    await this.db.query(
      "INSERT INTO conversation_turns(id,conversation_id,turn_number,transcript,intent,confidence,reasoning_summary,language,processing_started_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,NOW())",
      [
        id,
        conversationId,
        n,
        transcript,
        intent,
        confidence,
        reason ?? null,
        language ?? null,
      ],
    );
    return { id, number: n };
  }
  async classifyTurn(
    id: string,
    intent: Intent,
    confidence: number,
    reason?: string,
    language?: Language,
  ) {
    await this.db.query(
      "UPDATE conversation_turns SET intent=$2,confidence=$3,reasoning_summary=$4,language=COALESCE($5,language) WHERE id=$1",
      [id, intent, confidence, reason ?? null, language ?? null],
    );
  }
  async cancelConfirmation(restaurantId: string, confirmationId: string) {
    await this.db.query(
      "UPDATE action_confirmations SET status='CANCELLED' WHERE id=$1 AND restaurant_id=$2 AND status IN ('READY','CONFIRMED')",
      [confirmationId, restaurantId],
    );
  }
  async finishTurn(id: string) {
    await this.db.query(
      "UPDATE conversation_turns SET processing_completed_at=NOW() WHERE id=$1",
      [id],
    );
  }
  async update(c: Conversation, state: ConversationState, language?: Language) {
    await this.db.query(
      "UPDATE conversations SET state=$1,language=COALESCE($2,language) WHERE id=$3 AND restaurant_id=$4",
      [JSON.stringify(state), language ?? null, c.id, c.restaurantId],
    );
  }
  async toolCall(input: {
    restaurantId: string;
    conversationId: string;
    turnId: string;
    name: string;
    arguments: unknown;
    result: unknown;
    status: string;
    key: string;
    duration: number;
  }) {
    await this.db.query(
      "INSERT INTO conversation_tool_calls(id,restaurant_id,conversation_id,turn_id,tool_name,arguments,result,status,idempotency_key,duration_ms) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(idempotency_key) DO NOTHING",
      [
        randomUUID(),
        input.restaurantId,
        input.conversationId,
        input.turnId,
        input.name,
        JSON.stringify(input.arguments),
        JSON.stringify(input.result),
        input.status,
        input.key,
        input.duration,
      ],
    );
  }
  async usage(input: {
    restaurantId: string;
    conversationId: string;
    turnId: string;
    requestId: string;
    provider: string;
    model: string;
    latency: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  }) {
    await this.db.query(
      "INSERT INTO ai_usage(id,restaurant_id,conversation_id,turn_id,request_id,provider,model,input_tokens,output_tokens,total_tokens,latency_ms) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
      [
        randomUUID(),
        input.restaurantId,
        input.conversationId,
        input.turnId,
        input.requestId,
        input.provider,
        input.model,
        input.inputTokens,
        input.outputTokens,
        input.totalTokens,
        input.latency,
      ],
    );
  }
  async timeline(restaurantId: string, callId: string) {
    const c = await this.conversation(restaurantId, callId);
    if (!c) return undefined;
    const [turns, tools, messages] = await Promise.all([
      this.db.query(
        'SELECT turn_number "turnNumber",transcript,intent,confidence,language,created_at "createdAt" FROM conversation_turns WHERE conversation_id=$1 ORDER BY turn_number',
        [c.id],
      ),
      this.db.query(
        'SELECT tool_name "toolName",status,duration_ms "durationMs",created_at "createdAt" FROM conversation_tool_calls WHERE conversation_id=$1 ORDER BY created_at',
        [c.id],
      ),
      this.messages(c.id),
    ]);
    return {
      conversation: c,
      turns: turns.rows,
      toolCalls: tools.rows,
      messages,
    };
  }
}
