import {
  ActionRegistry,
  isMutationTool,
  type LlmToolDefinition,
  type MutationToolName,
} from "./action-registry.js";
import { RestaurantContextService } from "./context-service.js";
import { ConversationRepository } from "./conversation-repository.js";
import { ReceptionistInstructionBuilder } from "./instructions.js";
import { ResponseGenerator } from "./response-generator.js";
import { writeAudit } from "../observability.js";
import {
  ReservationConfirmationService,
  type SensitiveAction,
} from "../domain/action-engine.js";
import {
  emptyState,
  toolMessage,
  type AIProvider,
  type ConversationState,
  type Intent,
  type IntentResult,
  type Language,
  type ToolDecision,
} from "./types.js";

const sensitiveAction: Record<MutationToolName, SensitiveAction> = {
  create_reservation: "CREATE_RESERVATION",
  modify_reservation: "MODIFY_RESERVATION",
  cancel_reservation: "CANCEL_RESERVATION",
  create_order: "CREATE_ORDER",
  modify_order: "MODIFY_ORDER",
  cancel_order: "CANCEL_ORDER",
};
const confirmationTools: LlmToolDefinition[] = [
  {
    name: "confirm_pending_action",
    description:
      "Execute the reservation/order proposal awaiting confirmation. Call only after the caller has clearly said yes to the details you read back.",
    inputSchema: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
  {
    name: "cancel_pending_action",
    description:
      "Discard the proposal awaiting confirmation because the caller declined it or wants to change details.",
    inputSchema: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
];
/** Sorted-key deep copy so a proposal hashes identically after a JSONB round trip. */
const canonical = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.keys(value as Record<string, unknown>)
            .sort()
            .map((k) => [k, canonical((value as Record<string, unknown>)[k])]),
        )
      : value;
const failure = (error: unknown) => {
  const e = error as { code?: unknown; message?: unknown; details?: unknown };
  const code = typeof e?.code === "string" ? e.code : "ACTION_FAILED";
  return {
    success: false,
    error: {
      code,
      // Validation issues help the model correct its own arguments; they are never read to the caller.
      message: code === "INVALID_ACTION_INPUT" ? "Invalid arguments" : "The requested action could not be completed.",
      ...(code === "INVALID_ACTION_INPUT" ? { details: e.details } : {}),
    },
  };
};
const MAX_TOOL_STEPS = 5;

export class AIOrchestrator {
  constructor(
    private readonly provider: AIProvider,
    private readonly conversations: ConversationRepository,
    private readonly context = new RestaurantContextService(),
    private readonly actions = new ActionRegistry(conversations.db),
    private readonly instructions = new ReceptionistInstructionBuilder(),
    private readonly responses = new ResponseGenerator(),
    private readonly threshold = 0.7,
    private readonly confirmations = new ReservationConfirmationService(conversations.db),
  ) {}
  async processTurn(input: {
    requestId: string;
    restaurantId: string;
    callSessionId: string;
    correlationId?: string;
    transcript: string;
    language?: Language;
    callerPhone?: string;
    signal?: AbortSignal;
  }) {
    if (input.signal?.aborted) throw new Error("AI turn cancelled");
    const call = await this.conversations.callForRestaurant(
      input.restaurantId,
      input.callSessionId,
    );
    if (!call) throw new Error("Call session not found for restaurant");
    const trustedRestaurantId = call.restaurant_id;
    const conversation = await this.conversations.ensureConversation(
      trustedRestaurantId,
      input.callSessionId,
    );
    const brain = await this.conversations.brain(trustedRestaurantId);
    if (!brain) throw new Error("Restaurant Brain is unavailable");
    if (brain.seasonalStatus !== "ACTIVE") {
      const language = conversation.language ?? input.language ?? "EN";
      return {
        conversationId: conversation.id,
        intent: "GENERAL_QUESTION" as Intent,
        language,
        assistantText:
          brain.seasonalClosedMessage[language.toLowerCase()] ??
          (language === "ES"
            ? "El restaurante está cerrado por temporada."
            : "The restaurant is closed for the season."),
        toolCall: null,
        transferTo: undefined as string | undefined,
      };
    }
    const started = Date.now();
    const prior = conversation.state ?? emptyState();
    // Intent classification runs alongside tool selection: on a phone call every
    // sequential model round trip is audible latency.
    const classificationPromise: Promise<IntentResult> = this.provider
      .detectIntent({
        requestId: input.requestId,
        text: input.transcript,
        state: prior,
        context: "Controlled Restaurant Brain context only",
        timeoutMs: 6000,
        signal: input.signal,
      })
      .catch(() => ({ intent: "UNKNOWN" as Intent, confidence: 0 }));
    const provisionalLanguage = conversation.language ?? input.language ?? "EN";
    const turn = await this.conversations.startTurn(
      conversation.id,
      input.transcript,
      "UNKNOWN",
      0,
      undefined,
      provisionalLanguage,
    );
    await this.conversations.addMessage(conversation.id, "USER", input.transcript);
    let state: ConversationState = { ...prior, language: provisionalLanguage };
    const instruction = () =>
      this.instructions.build({
        restaurantName: brain.restaurantName ?? "the restaurant",
        timezone: brain.timezone,
        language: state.language,
        intent: state.currentIntent ?? "UNKNOWN",
        state,
        businessInstructions: brain.aiInstructions,
        callerPhone: input.callerPhone,
        context: this.context.resolve(brain, "RESTAURANT_INFO").summary,
      });
    const tools = [...this.actions.llmDefinitions(), ...confirmationTools];
    let lastDecision: ToolDecision = null;
    let lastResult: unknown;
    for (let step = 0; step < MAX_TOOL_STEPS; step++) {
      if (input.signal?.aborted) throw new Error("AI turn cancelled");
      let decision: ToolDecision;
      try {
        decision = await this.provider.decideToolCall({
          requestId: input.requestId,
          instructions: instruction(),
          messages: await this.conversations.messages(conversation.id),
          tools,
          timeoutMs: 8000,
          signal: input.signal,
        });
      } catch (error) {
        if (input.signal?.aborted) throw error;
        lastResult = failure(error);
        break;
      }
      if (!decision) break;
      const began = Date.now();
      const outcome = await this.runDecision(decision, {
        brain,
        state,
        restaurantId: trustedRestaurantId,
        conversationId: conversation.id,
        callSessionId: input.callSessionId,
        turnNumber: turn.number,
        step,
      });
      state = outcome.state;
      lastDecision = decision;
      lastResult = outcome.result;
      const succeeded = !(outcome.result && typeof outcome.result === "object" && (outcome.result as { success?: unknown }).success === false);
      await writeAudit(this.conversations.db, { restaurantId: trustedRestaurantId, action: decision.name, entityType: "AI_ACTION", actorType: "AI", callId: input.callSessionId, conversationId: conversation.id, requestId: input.requestId, correlationId: input.correlationId ?? input.requestId, result: succeeded ? "SUCCESS" : "FAILED", metadata: { turnId: turn.id, step } });
      await this.conversations.toolCall({
        restaurantId: trustedRestaurantId,
        conversationId: conversation.id,
        turnId: turn.id,
        name: decision.name,
        arguments: decision.arguments,
        result: outcome.result,
        status: succeeded ? "SUCCESS" : "FAILED",
        key: [trustedRestaurantId, input.callSessionId, conversation.id, turn.number, step, decision.name].join(":"),
        duration: Date.now() - began,
      });
      await this.conversations.addMessage(
        conversation.id,
        "TOOL",
        toolMessage(decision.name, decision.arguments, outcome.result),
      );
      if (decision.name === "request_human_transfer") break;
    }
    const classification = await classificationPromise;
    const intent = classification.confidence >= this.threshold ? classification.intent : "UNKNOWN";
    const language = classification.language ?? provisionalLanguage;
    state = {
      ...state,
      language,
      currentIntent: intent,
      previousIntent: prior.currentIntent,
      needsHuman: intent === "HUMAN_REQUEST" || lastDecision?.name === "request_human_transfer",
      lastToolResult: lastResult,
    };
    await this.conversations.classifyTurn(turn.id, intent, classification.confidence, classification.reasoningSummary, language);
    let assistantText = "";
    try {
      const generated = await this.provider.generateResponse({
        requestId: input.requestId,
        instructions: instruction(),
        messages: await this.conversations.messages(conversation.id),
        tools,
        timeoutMs: 8000,
        signal: input.signal,
      });
      assistantText = generated.text.trim();
    } catch (error) {
      if (input.signal?.aborted) throw error;
    }
    if (!assistantText)
      assistantText = this.responses.generate({
        intent,
        language,
        toolName: lastDecision?.name,
        toolResult: lastResult,
        transfer: lastDecision?.name === "request_human_transfer",
      });
    await this.conversations.addMessage(conversation.id, "ASSISTANT", assistantText);
    await this.conversations.update(conversation, state, language);
    await this.conversations.finishTurn(turn.id);
    const usage = this.provider.drainUsage?.(input.requestId);
    await this.conversations.usage({
      restaurantId: trustedRestaurantId,
      conversationId: conversation.id,
      turnId: turn.id,
      requestId: input.requestId,
      provider: this.provider.name,
      model: usage?.model ?? "deterministic-mock",
      latency: Date.now() - started,
      inputTokens: usage?.inputTokens ?? 0,
      outputTokens: usage?.outputTokens ?? 0,
      totalTokens: usage?.totalTokens ?? 0,
    });
    const transferResult = lastDecision?.name === "request_human_transfer" ? (lastResult as { transferAvailable?: boolean } | undefined) : undefined;
    return {
      conversationId: conversation.id,
      turnId: turn.id,
      intent,
      confidence: classification.confidence,
      language,
      assistantText,
      toolCall: lastDecision ? { name: lastDecision.name, result: lastResult } : null,
      transferTo: transferResult?.transferAvailable ? brain.humanTransfer.destination : undefined,
    };
  }

  private async runDecision(
    decision: NonNullable<ToolDecision>,
    ctx: {
      brain: NonNullable<Awaited<ReturnType<ConversationRepository["brain"]>>>;
      state: ConversationState;
      restaurantId: string;
      conversationId: string;
      callSessionId: string;
      turnNumber: number;
      step: number;
    },
  ): Promise<{ state: ConversationState; result: unknown }> {
    const { state, restaurantId, conversationId } = ctx;
    try {
      if (decision.name === "confirm_pending_action") {
        const pending = state.pendingAction;
        if (!pending)
          return { state, result: { success: false, error: { code: "NO_PENDING_ACTION", message: "Nothing is awaiting confirmation." } } };
        const args = canonical(pending.arguments) as Record<string, unknown>;
        await this.confirmations.confirm(restaurantId, pending.confirmationId, args);
        const result = (await this.actions.execute(
          pending.tool,
          { ...args, confirmationId: pending.confirmationId },
          ctx.brain,
          {
            restaurantId,
            actorType: "AI",
            conversationId,
            confirmationId: pending.confirmationId,
            idempotencyKey: `${restaurantId}:confirm:${pending.confirmationId}`,
          },
        )) as Record<string, unknown>;
        const reservation = result?.reservation as { confirmation_code?: string } | undefined;
        const order = result?.order as { order_number?: string; total_cents?: number } | undefined;
        return {
          state: { ...state, pendingAction: undefined },
          result: {
            success: true,
            action: pending.tool,
            confirmationCode: reservation?.confirmation_code,
            orderNumber: order?.order_number,
            totalCents: order?.total_cents,
            details: result,
          },
        };
      }
      if (decision.name === "cancel_pending_action") {
        if (state.pendingAction)
          await this.conversations.cancelConfirmation(restaurantId, state.pendingAction.confirmationId);
        return { state: { ...state, pendingAction: undefined }, result: { success: true, discarded: Boolean(state.pendingAction) } };
      }
      if (isMutationTool(decision.name)) {
        const args = canonical(this.actions.validateProposal(decision.name, decision.arguments)) as Record<string, unknown>;
        if (state.pendingAction)
          await this.conversations.cancelConfirmation(restaurantId, state.pendingAction.confirmationId);
        const prepared = await this.confirmations.prepare(restaurantId, conversationId, sensitiveAction[decision.name], args);
        return {
          state: { ...state, pendingAction: { tool: decision.name, arguments: args, confirmationId: prepared.id } },
          result: {
            state: "READY_FOR_CONFIRMATION",
            proposal: args,
            next: "Read the details back to the caller and ask them to confirm.",
          },
        };
      }
      const result = await this.actions.execute(decision.name, decision.arguments, ctx.brain, {
        restaurantId,
        actorType: "AI",
        conversationId,
        idempotencyKey: [restaurantId, ctx.callSessionId, conversationId, ctx.turnNumber, ctx.step, decision.name].join(":"),
      });
      return { state, result };
    } catch (error) {
      return { state, result: failure(error) };
    }
  }
}
