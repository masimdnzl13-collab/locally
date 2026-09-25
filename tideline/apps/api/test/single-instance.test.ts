import { describe, expect, it } from "vitest";
import { acquireSingletonLock, SingletonLockError } from "../src/database/singleton-lock.js";
import { VoiceSessionManager } from "../src/voice/session-manager.js";
import type { CallSession, TtsAudio } from "../src/voice/contracts.js";
import type { Env } from "../src/config/env.js";

// Postgres session-level advisory lock semantics: a lock belongs to the connection that took it
// and is freed on unlock or when that connection closes. pg-mem has no advisory locks, so this
// fake models exactly that.
function fakePostgres() {
  const held = new Map<string, number>();
  let nextConnection = 1;
  const pool = () => ({
    connect: async () => {
      const id = nextConnection++;
      const errorHandlers: ((e: Error) => void)[] = [];
      const client = {
        query: async <T>(sql: string, [a, b]: [number, number]) => {
          const key = `${a}:${b}`;
          if (sql.includes("pg_try_advisory_lock")) {
            const owner = held.get(key);
            if (owner === undefined || owner === id) held.set(key, id);
            return { rows: [{ locked: held.get(key) === id }] as T[] };
          }
          if (sql.includes("pg_advisory_unlock") && held.get(key) === id) held.delete(key);
          return { rows: [] as T[] };
        },
        release: () => {},
        on: (_event: string, handler: (e: Error) => void) => errorHandlers.push(handler),
        // Simulates the server dropping this connection: Postgres frees its session locks.
        drop: () => {
          for (const [key, owner] of held) if (owner === id) held.delete(key);
          errorHandlers.forEach((h) => h(new Error("Connection terminated unexpectedly")));
        },
      };
      return client;
    },
  });
  return { pool, held };
}

describe("single API instance guard", () => {
  it("lets the first instance start and refuses a second one", async () => {
    const pg = fakePostgres();
    const first = await acquireSingletonLock(pg.pool(), { waitMs: 0 });
    await expect(acquireSingletonLock(pg.pool(), { waitMs: 0 })).rejects.toBeInstanceOf(SingletonLockError);
    await first.release();
    await expect(acquireSingletonLock(pg.pool(), { waitMs: 0 })).resolves.toBeDefined();
  });

  it("waits out a redeploy: the new instance starts once the old one lets go", async () => {
    const pg = fakePostgres();
    const old = await acquireSingletonLock(pg.pool(), { waitMs: 0 });
    const next = acquireSingletonLock(pg.pool(), { waitMs: 1_000, retryEveryMs: 20 });
    setTimeout(() => void old.release(), 50);
    await expect(next).resolves.toBeDefined();
  });

  it("frees the lock when the holder's connection dies, and tells the holder", async () => {
    const pg = fakePostgres();
    const lost: string[] = [];
    let holderClient: { drop: () => void } | undefined;
    const pool = pg.pool();
    const trackingPool = { connect: async () => { const c = await pool.connect(); holderClient ??= c; return c; } };
    await acquireSingletonLock(trackingPool, { waitMs: 0, onLost: (e) => lost.push(e.message) });
    holderClient!.drop();
    expect(lost).toEqual(["Connection terminated unexpectedly"]);
    await expect(acquireSingletonLock(pg.pool(), { waitMs: 0 })).resolves.toBeDefined();
  });
});

// Why the guard exists: with two instances behind a load balancer, Twilio's incoming webhook can
// create the session on instance A while the media WebSocket (or a later status callback) lands
// on instance B. B has no in-memory session, so the caller's audio and transcripts are dropped.
describe("what breaks with two API instances", () => {
  const env = { VOICE_RESPONSE_TIMEOUT_MS: 1000, VOICE_PROVIDER_TIMEOUT_MS: 1000, VOICE_ENGLISH_VOICE: "en-US", VOICE_SPANISH_VOICE: "es-US" } as Env;
  const audio = (): TtsAudio => ({ buffer: Buffer.from([1]), encoding: "pcm_s16le", sampleRateHz: 8000, channels: 1 });
  const instance = () =>
    new VoiceSessionManager(
      { updateCall: async () => {}, event: async () => {}, endSession: async () => {} } as never,
      { startSession: async () => {}, sendAudio: async () => {}, endSession: async () => {} },
      { synthesize: async () => audio() },
      { respond: async () => ({ responseText: "hi", nextState: "LISTENING", actions: [] }) },
      { incomingResponse: () => "", stopPlayback: async () => {}, transfer: async () => {} },
      env,
    );

  it("a call started on instance A is unknown to instance B", async () => {
    const session: CallSession = { id: "s-1", callId: "c-1", restaurantId: "r-1", state: "INITIALIZING", startedAt: new Date() };
    const a = instance();
    const b = instance();
    await a.begin(session, "c-1", "r-1");
    await expect(a.audio("s-1", Buffer.from([0]))).resolves.toBeUndefined();
    await expect(b.audio("s-1", Buffer.from([0]))).rejects.toThrow("Unknown voice session");
    await expect(b.transcript("s-1", "two large pizzas")).rejects.toThrow("Unknown voice session");
  });
});
