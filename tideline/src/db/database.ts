import Database from 'better-sqlite3'; import { migrate } from './migrate.js';
export type Db = Database.Database;
export const now = () => new Date().toISOString();
export const id = () => crypto.randomUUID();
export const json = (value: unknown) => JSON.stringify(value);
export const parseJson = <T>(value: string | null | undefined, fallback: T): T => { try { return value ? JSON.parse(value) as T : fallback; } catch { return fallback; } };
export function openDatabase(path?: string): Db { return migrate(path); }
