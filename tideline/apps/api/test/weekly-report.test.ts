import { describe, expect, it } from "vitest";
import { newDb } from "pg-mem";
import { SignJWT } from "jose";
import { createApp } from "../src/app.js";
import { loadEnv } from "../src/config/env.js";
import { migrate } from "../src/database/migrate.js";

// AE — GET /internal/restaurants/:id/weekly-report. The SQL aggregates (calls, converted calls,
// avg duration, top intents per conversation) need the voice/AI tables, which pg-mem cannot
// migrate; they were verified against real Postgres (PGlite) when written. Here: the route
// contract (service token, restaurant must exist).
const secret = "test-secret-that-is-long-enough-for-security";
const env = loadEnv({ APP_ENV: "test", DATABASE_URL: "postgres://localhost/test", JWT_SECRET: secret, CORS_ORIGINS: "http://localhost:5173", LOG_LEVEL: "fatal", TELEPHONY_MODE: "test" });
const token = (audience = "tideline-service") =>
  new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setIssuer("locally").setAudience(audience).setIssuedAt().setExpirationTime("60s").sign(new TextEncoder().encode(secret));

describe("GET /api/v1/internal/restaurants/:id/weekly-report", () => {
  it("requires Locally's service token and a known restaurant", async () => {
    const memory = newDb({ noAstCoverageCheck: true });
    memory.public.registerFunction({ name: "now", returns: "timestamptz" as never, implementation: () => new Date() });
    const db = new (memory.adapters.createPg().Pool)();
    await migrate(db as never, undefined, (name) => ["001_initial.sql", "010_auth_sessions.sql"].includes(name));
    const app = createApp(env, db as never, { voice: {} as never });
    await app.ready();
    const url = "/api/v1/internal/restaurants/00000000-0000-0000-0000-000000000009/weekly-report";
    expect((await app.inject({ url })).statusCode).toBe(401);
    expect((await app.inject({ url, headers: { "x-service-token": await token("tideline-sso") } })).statusCode).toBe(401);
    expect((await app.inject({ url, headers: { "x-service-token": await token() } })).statusCode).toBe(404);
    expect((await app.inject({ url: "/api/v1/internal/restaurants/not-a-uuid/weekly-report", headers: { "x-service-token": await token() } })).statusCode).toBe(400);
    await app.close();
    await db.end();
  });
});
