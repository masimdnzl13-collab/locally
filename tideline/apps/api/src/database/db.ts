import pg from "pg";
import { currentTenant } from "./tenant-context.js";
// Avoid pg's default DATE->Date conversion, which shifts the day when the server timezone is ahead of UTC.
pg.types.setTypeParser(1082, (value: string) => value);
export type Db = Pick<pg.Pool, "query" | "end" | "connect">;
export type Tx = pg.PoolClient;
export async function withTransaction<T>(
  db: Db,
  work: (tx: Tx) => Promise<T>,
): Promise<T> {
  const tx = await db.connect();
  try {
    await tx.query("BEGIN");
    const tenant = currentTenant();
    if (tenant)
      await tx.query("SELECT set_config('app.restaurant_id', $1, true)", [
        tenant,
      ]);
    const result = await work(tx);
    await tx.query("COMMIT");
    return result;
  } catch (error) {
    await tx.query("ROLLBACK");
    throw error;
  } finally {
    tx.release();
  }
}
export function createDb(connectionString: string): pg.Pool {
  const pool = new pg.Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    statement_timeout: 15000,
    application_name: "restaurant-ai-receptionist",
  });
  const query = pool.query.bind(pool);
  pool.query = (async (text: string, values?: unknown[]) => {
    const tenant = currentTenant();
    if (!tenant) return query(text, values);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.restaurant_id', $1, true)", [
        tenant,
      ]);
      const result = await client.query(text, values);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }) as pg.Pool["query"];
  return pool;
}
