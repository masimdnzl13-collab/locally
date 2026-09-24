import { afterEach, describe, expect, it } from "vitest";
import { newDb } from "pg-mem";
import { createApp } from "../src/app.js";
import { migrate } from "../src/database/migrate.js";
import type { Env } from "../src/config/env.js";
import { SignJWT } from "jose";
const env = {
  APP_ENV: "test",
  PORT: 3000,
  DATABASE_URL: "postgres://test",
  APP_URL: "http://localhost:5173",
  API_URL: "http://localhost:3000",
  JWT_SECRET: "test-secret-that-is-long-enough-for-security",
  LOG_LEVEL: "silent" as Env["LOG_LEVEL"],
  CORS_ORIGINS: "http://localhost:5173",
  TELEPHONY_MODE: "test",
  VOICE_STREAM_PATH: "/api/v1/telephony/twilio/media",
} as unknown as Env;
async function setup() {
  const memory = newDb({ noAstCoverageCheck: true });
  memory.public.registerFunction({
    name: "now",
    returns: "timestamptz" as never,
    implementation: () => new Date(),
  });
  const adapter = memory.adapters.createPg();
  const db = new adapter.Pool();
  await migrate(db as never, undefined, (name) => name === "001_initial.sql" || name === "010_auth_sessions.sql" || name === "018_sso_assertions.sql");
  const app = createApp(env, db as never);
  await app.ready();
  return { app, db };
}
const apps: { close: () => Promise<void> }[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((x) => x.close()));
});
async function register(
  app: Awaited<ReturnType<typeof setup>>["app"],
  email: string,
) {
  const r = await app.inject({
    method: "POST",
    url: "/api/v1/auth/register",
    payload: { email, password: "SecurePassword123!" },
  });
  return r.json() as { token: string; user: { id: string } };
}
describe("foundation API", () => {
  it("starts and reports health", async () => {
    const x = await setup();
    const r = await x.app.inject("/health");
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ status: "ok" });
    await x.app.close();
    await x.db.end();
  });
  it("registers, logs in, rejects invalid login, and validates payloads", async () => {
    const x = await setup();
    apps.push(x.app);
    const account = await register(x.app, "a@example.test");
    expect(account.token).toBeTypeOf("string");
    const login = await x.app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "a@example.test", password: "SecurePassword123!" },
    });
    expect(login.statusCode).toBe(200);
    const invalid = await x.app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "a@example.test", password: "no" },
    });
    expect(invalid.statusCode).toBe(400);
    const wrong = await x.app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "a@example.test", password: "WrongPassword123!" },
    });
    expect(wrong.json().error.code).toBe("INVALID_CREDENTIALS");
  });
  it("requires authentication and enforces tenant membership and roles", async () => {
    const x = await setup();
    apps.push(x.app);
    const a = await register(x.app, "a@example.test"),
      b = await register(x.app, "b@example.test");
    const create = await x.app.inject({
      method: "POST",
      url: "/api/v1/restaurants",
      headers: { authorization: `Bearer ${a.token}` },
      payload: { name: "A Cafe", slug: "a-cafe", timezone: "UTC" },
    });
    expect(create.statusCode).toBe(201);
    const restaurant = create.json().restaurant;
    const unauth = await x.app.inject("/api/v1/me");
    expect(unauth.statusCode).toBe(401);
    const denied = await x.app.inject({
      url: `/api/v1/restaurants/${restaurant.id}`,
      headers: { authorization: `Bearer ${b.token}` },
    });
    expect(denied.statusCode).toBe(403);
    const allowed = await x.app.inject({
      url: `/api/v1/restaurants/${restaurant.id}`,
      headers: { authorization: `Bearer ${a.token}` },
    });
    expect(allowed.statusCode).toBe(200);
  });
  it("rejects a token after logout, including concurrent requests", async () => {
    const x = await setup();
    apps.push(x.app);
    const account = await register(x.app, "logout@example.test");
    expect((await x.app.inject({ url: "/api/v1/me", headers: { authorization: `Bearer ${account.token}` } })).statusCode).toBe(200);
    expect((await x.app.inject({ method: "POST", url: "/api/v1/auth/logout", headers: { authorization: `Bearer ${account.token}` } })).statusCode).toBe(200);
    const requests = await Promise.all(Array.from({ length: 5 }, () => x.app.inject({ url: "/api/v1/me", headers: { authorization: `Bearer ${account.token}` } })));
    expect(requests.every((response) => response.statusCode === 401)).toBe(true);
  });
  it("rejects expired tokens safely", async () => {
    const x = await setup();
    apps.push(x.app);
    const expired = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject("00000000-0000-0000-0000-000000000000").setJti("00000000-0000-0000-0000-000000000001").setIssuedAt(0).setExpirationTime("0s").sign(new TextEncoder().encode(env.JWT_SECRET));
    const response = await x.app.inject({ url: "/api/v1/me", headers: { authorization: `Bearer ${expired}` } });
    expect(response.statusCode).toBe(401);
    expect(response.json().error.message).toBe("Authentication required");
  });
  it("exchanges a single-use Locally SSO assertion for a Tideline session", async () => {
    const x = await setup();
    apps.push(x.app);
    const owner = await register(x.app, "owner@example.test");
    const created = await x.app.inject({ method: "POST", url: "/api/v1/restaurants", headers: { authorization: `Bearer ${owner.token}` }, payload: { name: "Harbor", slug: "harbor" } });
    const restaurantId = created.json().restaurant.id as string;
    const key = new TextEncoder().encode(env.JWT_SECRET);
    const assertion = (claims: Record<string, unknown>, issuer = "locally", audience = "tideline-sso") =>
      new SignJWT(claims).setProtectedHeader({ alg: "HS256" }).setIssuer(issuer).setAudience(audience).setSubject("locally-user").setJti(crypto.randomUUID()).setIssuedAt().setExpirationTime("60s").sign(key);
    const good = await assertion({ email: "Manager@Example.test", restaurant_id: restaurantId });
    const exchanged = await x.app.inject({ method: "POST", url: "/api/v1/auth/sso", payload: { assertion: good } });
    expect(exchanged.statusCode).toBe(200);
    expect(exchanged.json().restaurantId).toBe(restaurantId);
    const me = await x.app.inject({ url: "/api/v1/me", headers: { authorization: `Bearer ${exchanged.json().token}` } });
    expect(me.json().user.email).toBe("manager@example.test");
    expect(me.json().restaurants.map((r: { id: string; role: string }) => [r.id, r.role])).toEqual([[restaurantId, "OWNER"]]);
    // Replay, wrong audience, unknown restaurant, and using the assertion as a bearer token all fail.
    expect((await x.app.inject({ method: "POST", url: "/api/v1/auth/sso", payload: { assertion: good } })).statusCode).toBe(401);
    expect((await x.app.inject({ method: "POST", url: "/api/v1/auth/sso", payload: { assertion: await assertion({ email: "a@example.test", restaurant_id: restaurantId }, "locally", "other") } })).statusCode).toBe(401);
    expect((await x.app.inject({ method: "POST", url: "/api/v1/auth/sso", payload: { assertion: await assertion({ email: "a@example.test", restaurant_id: "00000000-0000-4000-8000-000000000000" }) } })).statusCode).toBe(404);
    expect((await x.app.inject({ method: "POST", url: "/api/v1/auth/sso", payload: { assertion: owner.token } })).statusCode).toBe(401);
    expect((await x.app.inject({ url: "/api/v1/me", headers: { authorization: `Bearer ${await assertion({ email: "b@example.test", restaurant_id: restaurantId })}` } })).statusCode).toBe(401);
    // An existing Tideline user keeps their role and gets no duplicate membership.
    const again = await x.app.inject({ method: "POST", url: "/api/v1/auth/sso", payload: { assertion: await assertion({ email: "owner@example.test", restaurant_id: restaurantId }) } });
    expect(again.json().user.id).toBe(owner.user.id);
  });
});
