// Live call state (VoiceSessionManager: active sessions, playback, turn counters) lives in the
// API process's memory, so exactly ONE API instance may run (see docs/ARCHITECTURE.md, "Single
// API instance"). This enforces it: at startup the API takes a session-level Postgres advisory
// lock on a dedicated connection and keeps that connection open for its whole life. A second
// instance cannot get the lock and refuses to start. If the process dies, Postgres drops the
// connection and releases the lock, so a replacement can start.
//
// The worker process does not hold call state and does not take this lock.
export const API_SINGLETON_LOCK_KEY: readonly [number, number] = [0x7419, 1];

export class SingletonLockError extends Error {
  constructor() {
    super(
      "Another Tideline API instance is already running (Postgres advisory lock is held). " +
        "Call state is in-process memory; running two API instances splits calls. See docs/ARCHITECTURE.md.",
    );
    this.name = "SingletonLockError";
  }
}

export interface SingletonLock {
  release(): Promise<void>;
}

// Structural subset of pg.PoolClient (keeps the helper testable without a real server).
export interface LockClient {
  query<T>(sql: string, values: unknown[]): Promise<{ rows: T[] }>;
  release(): void;
  on(event: "error", handler: (error: Error) => void): unknown;
}

export async function acquireSingletonLock(
  pool: { connect(): Promise<LockClient> },
  options: {
    key?: readonly [number, number];
    // A redeploy stops the old container while the new one starts; wait out its shutdown grace
    // period (compose stop_grace_period: 30s) before giving up.
    waitMs?: number;
    retryEveryMs?: number;
    onLost?: (error: Error) => void;
  } = {},
): Promise<SingletonLock> {
  const key = options.key ?? API_SINGLETON_LOCK_KEY;
  const deadline = Date.now() + (options.waitMs ?? 45_000);
  const retryEveryMs = options.retryEveryMs ?? 3_000;
  for (;;) {
    const client = await pool.connect();
    let locked = false;
    try {
      const { rows } = await client.query<{ locked: boolean }>("SELECT pg_try_advisory_lock($1, $2) AS locked", [key[0], key[1]]);
      locked = rows[0]?.locked === true;
    } catch (error) {
      client.release();
      throw error;
    }
    if (locked) {
      // Losing this connection means losing the lock: another instance could start while this
      // one still serves calls. The caller should exit on onLost.
      client.on("error", (error: Error) => options.onLost?.(error));
      return {
        release: async () => {
          try {
            await client.query("SELECT pg_advisory_unlock($1, $2)", [key[0], key[1]]);
          } finally {
            client.release();
          }
        },
      };
    }
    client.release();
    if (Date.now() + retryEveryMs > deadline) throw new SingletonLockError();
    await new Promise((resolve) => setTimeout(resolve, retryEveryMs));
  }
}
