import { randomUUID } from "node:crypto";
import type { AIOrchestrator } from "../ai/orchestrator.js";
import { runWithTenant } from "../database/tenant-context.js";
import type { VoiceAIEngine, VoiceTurnContext, VoiceTurnResult } from "./contracts.js";

/** Routes each final caller utterance through the AI orchestrator (intent, Brain, tools, reply). */
export class OrchestratorVoiceEngine implements VoiceAIEngine {
  constructor(private readonly orchestrator: Pick<AIOrchestrator, "processTurn">) {}
  async respond(context: VoiceTurnContext, signal?: AbortSignal): Promise<VoiceTurnResult> {
    // Row-level security needs the tenant on every query issued for this turn.
    const turn = await runWithTenant(context.restaurantId, () =>
      this.orchestrator.processTurn({
        requestId: randomUUID(),
        correlationId: context.callId,
        restaurantId: context.restaurantId,
        callSessionId: context.sessionId,
        transcript: context.transcript,
        language: context.language === "es" ? "ES" : "EN",
        callerPhone: typeof context.restaurantContext.callerPhone === "string" ? context.restaurantContext.callerPhone : undefined,
        signal,
      }),
    );
    const toolName = turn.toolCall?.name;
    const pending = toolName && /^(create|modify|cancel)_(reservation|order)$/.test(toolName);
    return {
      responseText: turn.assistantText,
      nextState: "LISTENING",
      intent: turn.intent,
      language: turn.language === "ES" ? "es" : "en",
      actions: turn.toolCall ? [{ type: "TOOL", payload: { name: turn.toolCall.name } }] : [],
      shouldTransfer: Boolean(turn.transferTo),
      transferTo: turn.transferTo,
      // Never hang up on a caller who still has a proposal to confirm.
      shouldEndCall: turn.intent === "GOODBYE" && !pending,
    };
  }
}
