import { describe, expect, it } from "vitest";
import { newDb } from "pg-mem";
import { VoiceRepository } from "../src/repositories/voice-repository.js";

const R = "77777777-7777-4777-8777-777777777777";

describe("VoiceRepository.recentCallsFromCaller", () => {
  it("counts one caller's recent calls to one restaurant, excluding the current CallSid", async () => {
    const memory = newDb({ noAstCoverageCheck: true });
    memory.public.registerFunction({ name: "now", returns: "timestamptz" as never, implementation: () => new Date() });
    const db = new (memory.adapters.createPg().Pool)();
    // Only the calls columns this query touches (003_voice.sql needs plpgsql, which pg-mem lacks).
    await db.query(`CREATE TABLE calls (id UUID PRIMARY KEY, restaurant_id UUID NOT NULL, provider_call_id TEXT NOT NULL,
      caller_phone_number TEXT, started_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    const insert = (sid: string, caller: string | null, minutesAgo = 0) =>
      db.query(`INSERT INTO calls (id, restaurant_id, provider_call_id, caller_phone_number, started_at) VALUES ($1, $2, $3, $4, $5)`,
        [crypto.randomUUID(), R, sid, caller, new Date(Date.now() - minutesAgo * 60_000)]);
    await insert("CA1", "+15550001111");
    await insert("CA2", "+15550001111", 30);
    await insert("CA3", "+15559998888");
    await insert("CA4", null);
    const repo = new VoiceRepository(db as never);
    const q = (caller: string | null, windowMinutes = 10, exclude = "CA-new") =>
      repo.recentCallsFromCaller({ restaurantId: R, caller, windowMinutes, excludeProviderCallId: exclude });
    expect(await q("+15550001111")).toBe(1);
    expect(await q("+15550001111", 60)).toBe(2);
    expect(await q("+15550001111", 10, "CA1")).toBe(0);
    expect(await q(null)).toBe(1);
    await db.end();
  });
});
