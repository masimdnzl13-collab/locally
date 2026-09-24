import { describe, expect, it } from "vitest";
import { ClaudeAIProvider, toClaudeMessages } from "../src/ai/claude-provider.js";
import { emptyState, toolMessage, type ProviderMessage } from "../src/ai/types.js";

type Call = { method: "create" | "parse"; params: Record<string, any>; options: Record<string, any> };
function fakeClient(responses: Array<Record<string, any>>) {
  const calls: Call[] = [];
  const usage = { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
  const next = (method: Call["method"]) => async (params: Record<string, any>, options: Record<string, any>) => {
    calls.push({ method, params, options });
    return { model: "claude-opus-5", usage, stop_reason: "end_turn", content: [], ...responses.shift() };
  };
  return { calls, client: { beta: { messages: { create: next("create"), parse: next("parse") } } } as never };
}
const request = (messages: ProviderMessage[] = [{ role: "USER", content: "What time do you close?" }]) => ({
  requestId: "req-1",
  instructions: "You are the receptionist for Luigi's.",
  messages,
  tools: [
    { name: "get_business_hours", description: "Hours", inputSchema: { type: "object", properties: {}, required: [] } },
    { name: "get_menu", description: "Menu", inputSchema: { type: "object", properties: {}, required: [] } },
  ],
  timeoutMs: 5000,
});

describe("ClaudeAIProvider", () => {
  it("sends tools with the configured model, effort, and server-side fallbacks, and returns the tool call", async () => {
    const { client, calls } = fakeClient([
      { stop_reason: "tool_use", content: [{ type: "tool_use", id: "t1", name: "get_business_hours", input: {} }] },
    ]);
    const provider = new ClaudeAIProvider({ model: "claude-opus-5", effort: "low", client });
    const decision = await provider.decideToolCall(request());
    expect(decision).toEqual({ name: "get_business_hours", arguments: {} });
    const params = calls[0].params;
    expect(params.model).toBe("claude-opus-5");
    expect(params.output_config).toEqual({ effort: "low" });
    expect(params.fallbacks).toBe("default");
    expect(params.betas).toEqual(["server-side-fallback-2026-07-01"]);
    expect(params.tool_choice).toEqual({ type: "auto", disable_parallel_tool_use: true });
    expect(params.tools.map((t: { name: string }) => t.name)).toEqual(["get_business_hours", "get_menu"]);
    expect(params.tools[1].cache_control).toEqual({ type: "ephemeral" });
    expect(params.system).toContain("Luigi's");
    expect(calls[0].options.timeout).toBe(5000);
  });
  it("reuses the text reply when no tool was needed instead of making a second call", async () => {
    const { client, calls } = fakeClient([{ content: [{ type: "text", text: "We close at 10 tonight." }] }]);
    const provider = new ClaudeAIProvider({ model: "claude-opus-5", effort: "low", client });
    expect(await provider.decideToolCall(request())).toBeNull();
    const reply = await provider.generateResponse(request());
    expect(reply.text).toBe("We close at 10 tonight.");
    expect(calls).toHaveLength(1);
    expect(provider.drainUsage("req-1")).toMatchObject({ inputTokens: 100, outputTokens: 20, model: "claude-opus-5" });
  });
  it("generates a fresh reply with tools disabled after a tool result", async () => {
    const { client, calls } = fakeClient([{ content: [{ type: "text", text: "We close at 10." }] }]);
    const provider = new ClaudeAIProvider({ model: "claude-opus-5", effort: "low", client });
    const reply = await provider.generateResponse(request([
      { role: "USER", content: "When do you close?" },
      { role: "TOOL", content: toolMessage("get_business_hours", {}, { state: "KNOWN" }) },
    ]));
    expect(reply.text).toBe("We close at 10.");
    expect(calls[0].params.tool_choice).toEqual({ type: "none" });
  });
  it("treats a refusal as no tool call and no text so the orchestrator falls back safely", async () => {
    const { client } = fakeClient([{ stop_reason: "refusal", content: [] }, { stop_reason: "refusal", content: [] }]);
    const provider = new ClaudeAIProvider({ model: "claude-opus-5", effort: "low", client });
    expect(await provider.decideToolCall(request())).toBeNull();
    expect((await provider.generateResponse(request())).text).toBe("");
  });
  it("classifies intent through structured output", async () => {
    const { client, calls } = fakeClient([
      { parsed_output: { intent: "RESERVATION", confidence: 1.4, language: "ES", reasoningSummary: "Wants a table" } },
    ]);
    const provider = new ClaudeAIProvider({ model: "claude-opus-5", effort: "low", client });
    const result = await provider.detectIntent({ requestId: "r", text: "Quiero una mesa", state: emptyState(), context: "", timeoutMs: 3000 });
    expect(result).toEqual({ intent: "RESERVATION", confidence: 1, language: "ES", reasoningSummary: "Wants a table" });
    expect(calls[0].method).toBe("parse");
    expect(calls[0].params.output_config.format).toBeDefined();
  });
  it("renders stored history as alternating Messages API turns", () => {
    const out = toClaudeMessages([
      { role: "ASSISTANT", content: "Hello" },
      { role: "USER", content: "Table for two" },
      { role: "TOOL", content: toolMessage("check_reservation_availability", {}, { available: true }) },
      { role: "ASSISTANT", content: "Yes, available." },
    ]);
    expect(out.map((m) => m.role)).toEqual(["user", "assistant", "user", "assistant"]);
    expect(JSON.stringify(out[2].content)).toContain("<caller>Table for two</caller>");
    expect(JSON.stringify(out[2].content)).toContain("<tool_result>");
  });
});
