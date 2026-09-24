import { describe, expect, it, vi } from "vitest";
import { maskPhone, redactPii, safeError, serializeLoggedError } from "../src/observability.js";
import { DeepgramTtsProvider } from "../src/voice/tts-providers.js";


describe("PII redaction for logs", () => {
  it("masks phone numbers down to the last 4 digits", () => {
    expect(maskPhone("+14155550199")).toBe("***0199");
    expect(redactPii("The 'To' number +14155550199 is not a valid phone number.")).toBe("The 'To' number ***0199 is not a valid phone number.");
    expect(redactPii("caller (415) 555-0199 and 415.555.0123 and 4155550100")).toBe("caller ***0199 and ***0123 and ***0100");
    expect(redactPii('Key (restaurant_id, phone)=(r1, +13055550123) already exists.')).toBe("Key (restaurant_id, phone)=(r1, ***0123) already exists.");
  });

  it("leaves ids, dates and amounts alone", () => {
    const text = "call 550e8400-e29b-41d4-a716-446655440000 at 2026-09-25 10:15:00, order #12345 total 41.50, sid PN1234567890abcdef";
    expect(redactPii(text)).toBe(text);
  });

  it("redacts error messages, stacks and drops driver fields that echo input", () => {
    const pgError = Object.assign(new Error("duplicate key value violates unique constraint"), {
      code: "23505",
      detail: "Key (phone)=(+13055550123) already exists.",
      parameters: ["+13055550123", "2 large pizzas"],
    });
    const out = serializeLoggedError(pgError);
    expect(JSON.stringify(out)).not.toContain("3055550123");
    expect(JSON.stringify(out)).not.toContain("pizzas");
    expect(out).toMatchObject({ type: "Error", code: "23505" });

    const twilio = new Error("Twilio 400 (21211): The 'To' number +14155550199 is not a valid phone number.");
    expect(safeError(twilio)).not.toContain("4155550199");
    expect(serializeLoggedError(twilio).stack).not.toContain("4155550199");
  });

  it("never copies a TTS provider's response body into the error message", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ err_code: "INVALID_TEXT", err_msg: "Cannot speak: 'two large pepperoni for Jane at 415 555 0199'" }), { status: 400 }));
    const tts = new DeepgramTtsProvider("key", fetchImpl as unknown as typeof fetch);
    const error = await tts.synthesize({ text: "hello", voice: "en-US", language: "en" }).catch((e: Error) => e);
    expect(String((error as Error).message)).toBe("Deepgram TTS failed with HTTP 400 (INVALID_TEXT)");
  });
});
