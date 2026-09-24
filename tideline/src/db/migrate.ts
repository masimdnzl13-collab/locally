import Database from 'better-sqlite3';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
export const dbPath = process.env.DATABASE_PATH ?? 'data/restaurant.db';
const migrationsDir = fileURLToPath(new URL('./migrations', import.meta.url));
export function migrate(path = dbPath) {
  mkdirSync(dirname(path), { recursive: true }); const db = new Database(path); db.pragma('foreign_keys = ON');
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)');
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
    const version = Number(file.split('_')[0]); if (!db.prepare('SELECT 1 FROM schema_migrations WHERE version=?').get(version)) {
      db.transaction(() => { db.exec(readFileSync(join(migrationsDir, file), 'utf8')); db.prepare('INSERT INTO schema_migrations VALUES (?,?)').run(version, new Date().toISOString()); })();
    }
  } return db;
}
if (process.argv[1]?.endsWith('migrate.ts')) { migrate().close(); console.log(`Migrated ${dbPath}`); }
