import { afterEach, describe, expect, it } from "vitest";
import { newDb } from "pg-mem";
import { SignJWT } from "jose";
import { createApp } from "../src/app.js";
import { migrate } from "../src/database/migrate.js";
import { loadEnv } from "../src/config/env.js";
import type { VoiceRuntime } from "../src/voice/runtime.js";

const secret = "test-secret-that-is-long-enough-for-security";
const env = loadEnv({ APP_ENV: "test", DATABASE_URL: "postgres://localhost/test", JWT_SECRET: secret, CORS_ORIGINS: "http://localhost:5173", LOG_LEVEL: "fatal" });
const R = "33333333-3333-4333-8333-333333333333";
const C = "44444444-4444-4444-8444-444444444444";
const token = () =>
  new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setIssuer("locally").setAudience("tideline-service").setIssuedAt().setExpirationTime("60s").sign(new TextEncoder().encode(secret));

const closers: (() => Promise<void>)[] = [];
afterEach(async () => {
  await Promise.all(closers.splice(0).map((x) => x()));
});

async function setup() {
  const memory = newDb({ noAstCoverageCheck: true });
  memory.public.registerFunction({ name: "now", returns: "timestamptz" as never, implementation: () => new Date() });
  const db = new (memory.adapters.createPg().Pool)();
  await migrate(db as never, undefined, (name) => ["001_initial.sql", "005_restaurant_brain.sql"].includes(name));
  const app = createApp(env, db as never, { voice: {} as VoiceRuntime });
  await app.ready();
  closers.push(async () => { await app.close(); await db.end(); });
  return { app, db };
}

describe("internal brain readiness", () => {
  it("counts distinct open weekdays and active menu items", async () => {
    const { app, db } = await setup();
    const url = `/api/v1/internal/restaurants/${R}/brain-readiness`;
    const get = async () => app.inject({ url, headers: { "x-service-token": await token() } });

    expect((await app.inject({ url })).statusCode).toBe(401);
    expect((await get()).statusCode).toBe(404);

    await db.query("INSERT INTO restaurants (id, name, slug, timezone) VALUES ($1, 'Luigi''s', 'luigis', 'America/New_York')", [R]);
    expect((await get()).json()).toEqual({ hoursDays: 0, menuItems: 0 });

    // Monday lunch + dinner, Tuesday lunch → 2 open weekdays.
    for (const [i, [weekday, start, end]] of ([[1, "11:00", "15:00"], [1, "17:00", "22:00"], [2, "11:00", "15:00"]] as const).entries())
      await db.query("INSERT INTO business_hours (id, restaurant_id, weekday, start_time, end_time) VALUES ($1, $2, $3, $4, $5)", [`5555555${i}-5555-4555-8555-555555555555`, R, weekday, start, end]);
    await db.query("INSERT INTO menu_categories (id, restaurant_id, name) VALUES ($1, $2, 'Mains')", [C, R]);
    for (const [i, active] of [true, true, false].entries())
      await db.query("INSERT INTO menu_items (id, restaurant_id, category_id, name, price_cents, active) VALUES ($1, $2, $3, $4, 1200, $5)", [`6666666${i}-6666-4666-8666-666666666666`, R, C, `Dish ${i}`, active]);

    expect((await get()).json()).toEqual({ hoursDays: 2, menuItems: 2 });
  });
});
