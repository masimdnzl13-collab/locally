import type { Env } from "../config/env.js";
import { ClaudeAIProvider } from "./claude-provider.js";
import { DeterministicMockAIProvider } from "./mock-provider.js";
import type { AIProvider } from "./types.js";

export function createAIProvider(env: Env): AIProvider {
  if (env.AI_PROVIDER === "anthropic")
    return new ClaudeAIProvider({
      // Unset falls back to the SDK's credential chain (ANTHROPIC_API_KEY, etc.).
      apiKey: env.AI_API_KEY,
      model: env.AI_MODEL,
      effort: env.AI_EFFORT,
    });
  if (env.APP_ENV === "production")
    throw new Error("The mock AI provider is not allowed in production");
  return new DeterministicMockAIProvider();
}
