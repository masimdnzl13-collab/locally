import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createDb, withTransaction, type Db } from "./db.js";
import { loadEnv } from "../config/env.js";

export async function migrate(
  db: Db,
  migrationDirectory = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../migrations",
  ),
  include: (filename: string) => boolean = () => true,
) {
  await withTransaction(db, async (tx) => {
    await tx.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())",
    );
    const applied = new Set(
      (
        await tx.query<{ version: string }>(
          "SELECT version FROM schema_migrations",
        )
      ).rows.map((row) => row.version),
    );
    const files = (await readdir(migrationDirectory))
      .filter((name) => name.endsWith(".sql") && include(name))
      .sort();
    for (const filename of files)
      if (!applied.has(filename)) {
        await tx.query(
          await readFile(join(migrationDirectory, filename), "utf8"),
        );
        await tx.query("INSERT INTO schema_migrations(version) VALUES ($1)", [
          filename,
        ]);
      }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const db = createDb(loadEnv().DATABASE_URL);
  migrate(db)
    .then(() => db.end())
    .catch(async (error) => {
      console.error(
        JSON.stringify({
          event: "migration_failed",
          error: error instanceof Error ? error.message : "unknown",
        }),
      );
      await db.end();
      process.exitCode = 1;
    });
}
