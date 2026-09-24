import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { loadEnv, type Env } from "../src/config/env.js";
import { TwilioTelephonyProvider, validateTwilioSignature } from "../src/voice/twilio-provider.js";
import type { VoiceRuntime } from "../src/voice/runtime.js";
import { createHmac } from "node:crypto";

const base = {
  APP_ENV: "test",
  DATABASE_URL: "postgres://localhost/test",
  JWT_SECRET: "test-secret-that-is-long-enough-for-security",
  CORS_ORIGINS: "http://localhost:5173",
  LOG_LEVEL: "fatal",
};
const twilioEnv = loadEnv({
  ...base,
  TELEPHONY_MODE: "twilio",
  TWILIO_ACCOUNT_SID: "AC123",
  TWILIO_AUTH_TOKEN: "secret-token",
  VOICE_PUBLIC_URL: "https://voice.example.com",
});
const db = { query: async () => ({ rows: [] }), connect: async () => ({}), end: async () => {} } as never;
function runtime() {
  const calls: string[] = [];
  const attached: string[] = [];
  const audio: string[] = [];
  const rt = {
    repo: {
      resolveActivePhone: async (phone: string) =>
        phone === "+15557654321"
          ? { restaurantId: "r1", restaurantName: "Luigi's", status: "ACTIVE", timezone: "UTC", voiceConfig: {}, phoneNumber: phone }
          : undefined,
      createCall: async () => ({ call: { id: "call-1", restaurantId: "r1" }, created: true }),
      createSession: async () => ({ id: "session-1", callId: "call-1", restaurantId: "r1", state: "INITIALIZING", startedAt: new Date() }),
      event: async () => {},
      restaurantContext: async () => ({}),
      updateProviderStatus: async (_p: string, sid: string, status: string) => { calls.push(`status:${sid}:${status}`); },
    },
    telephony: new TwilioTelephonyProvider("secret-token", "AC123"),
    manager: {
      begin: async (_s: unknown, _c: string, _r: string, ctx: Record<string, unknown>) => { calls.push(`begin:${ctx.providerCallId}`); },
      attachMedia: (id: string) => { attached.push(id); },
      audio: async (_id: string, frame: Buffer) => { audio.push(frame.toString()); },
      end: async (id: string, reason: string) => { calls.push(`end:${id}:${reason}`); },
      transcript: async () => {},
    },
  } as unknown as VoiceRuntime;
  return { rt, calls, attached, audio };
}
const sign = (url: string, params: Record<string, string>) =>
  createHmac("sha1", "secret-token")
    .update(url + Object.keys(params).sort().map((k) => k + params[k]).join(""))
    .digest("base64");
const apps: Array<{ close: () => Promise<unknown> }> = [];
afterEach(async () => { await Promise.all(apps.splice(0).map((a) => a.close())); });
async function start(env: Env) {
  const r = runtime();
  const app = createApp(env, db, { voice: r.rt });
  apps.push(app);
  await app.ready();
  return { app, ...r };
}

describe("telephony routes on the production app", () => {
  it("are registered by createApp", async () => {
    const { app } = await start(twilioEnv);
    const routes = app.printRoutes({ commonPrefix: false });
    expect(routes).toContain("/api/v1/telephony/twilio/incoming (POST)");
    expect(routes).toContain("/api/v1/telephony/twilio/status (POST)");
    expect(routes).toContain("/api/v1/telephony/twilio/media (GET, HEAD)");
    expect(routes).not.toContain("/api/v1/telephony/test/");
  });
  it("accepts a signed form-encoded Twilio webhook and returns streaming TwiML", async () => {
    const { app, calls } = await start(twilioEnv);
    const params = { CallSid: "CA111", To: "+15557654321", From: "+15551234567" };
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/telephony/twilio/incoming",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-twilio-signature": sign("https://voice.example.com/api/v1/telephony/twilio/incoming", params),
      },
      payload: new URLSearchParams(params).toString(),
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/xml");
    expect(response.body).toContain('<Stream url="wss://voice.example.com/api/v1/telephony/twilio/media">');
    expect(response.body).toContain('<Parameter name="sessionId" value="session-1" />');
    expect(response.body).toContain("Thank you for calling Luigi&apos;s");
    expect(calls).toContain("begin:CA111");
  });
  it("rejects webhooks with a bad signature", async () => {
    const { app, calls } = await start(twilioEnv);
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/telephony/twilio/incoming",
      headers: { "content-type": "application/x-www-form-urlencoded", "x-twilio-signature": "forged" },
      payload: "CallSid=CA1&To=%2B15557654321",
    });
    expect(response.statusCode).toBe(403);
    expect(calls).toHaveLength(0);
  });
  it("records call status callbacks", async () => {
    const { app, calls } = await start(twilioEnv);
    const params = { CallSid: "CA111", CallStatus: "completed" };
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/telephony/twilio/status",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-twilio-signature": sign("https://voice.example.com/api/v1/telephony/twilio/status", params),
      },
      payload: new URLSearchParams(params).toString(),
    });
    expect(response.statusCode).toBe(204);
    expect(calls).toContain("status:CA111:COMPLETED");
  });
  it("attaches the media stream by the sessionId custom parameter and forwards caller audio", async () => {
    const { app, attached, audio, calls } = await start(twilioEnv);
    const ws = await app.injectWS("/api/v1/telephony/twilio/media");
    const closed = new Promise((resolve) => ws.on("close", resolve));
    ws.send(JSON.stringify({ event: "connected" }));
    ws.send(JSON.stringify({ event: "start", start: { streamSid: "MZ1", customParameters: { sessionId: "session-1" } } }));
    ws.send(JSON.stringify({ event: "media", media: { track: "inbound", payload: Buffer.from("frame").toString("base64") } }));
    ws.send(JSON.stringify({ event: "stop" }));
    await new Promise((resolve) => setTimeout(resolve, 50));
    ws.terminate();
    await closed;
    expect(attached).toEqual(["session-1"]);
    expect(audio).toEqual(["frame"]);
    expect(calls).toContain("end:session-1:MEDIA_STOP");
  });
  it("exposes the transcript test endpoint only in test telephony mode", async () => {
    const { app } = await start(loadEnv({ ...base, TELEPHONY_MODE: "test" }));
    const response = await app.inject({ method: "POST", url: "/api/v1/telephony/test/sessions/session-1/events", payload: { type: "transcript", transcript: "hi" } });
    expect(response.statusCode).toBe(204);
  });
});

describe("Twilio helpers and env", () => {
  it("validates signatures", () => {
    const params = { A: "1" };
    expect(validateTwilioSignature("secret-token", "https://x/y", params, sign("https://x/y", params))).toBe(true);
    expect(validateTwilioSignature("secret-token", "https://x/y", params, "nope")).toBe(false);
  });
  it("parses TWILIO_VALIDATE_SIGNATURES=false as false", () => {
    expect(loadEnv({ ...base, TWILIO_VALIDATE_SIGNATURES: "false" }).TWILIO_VALIDATE_SIGNATURES).toBe(false);
    expect(loadEnv({ ...base }).TWILIO_VALIDATE_SIGNATURES).toBe(true);
    expect(() => loadEnv({ ...base, TWILIO_VALIDATE_SIGNATURES: "nope" })).toThrow();
  });
  it("requires provider keys for real STT/TTS providers", () => {
    expect(() => loadEnv({ ...base, STT_PROVIDER: "deepgram" })).toThrow(/STT_API_KEY/);
    expect(loadEnv({ ...base, STT_PROVIDER: "deepgram", STT_API_KEY: "k", AI_PROVIDER: "anthropic" }).AI_MODEL).toBe("claude-opus-5");
  });
  it("sends call control to the Twilio REST API", async () => {
    const requests: Array<{ url: string; body: string }> = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      requests.push({ url, body: String(init.body) });
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    const twilio = new TwilioTelephonyProvider("tok", "AC9", fetchImpl);
    await twilio.transfer({ providerCallId: "CA5", targetNumber: "+15550001111" });
    await twilio.hangup("CA5");
    expect(requests[0].url).toBe("https://api.twilio.com/2010-04-01/Accounts/AC9/Calls/CA5.json");
    expect(decodeURIComponent(requests[0].body)).toContain("<Dial>+15550001111</Dial>");
    expect(requests[1].body).toBe("Status=completed");
  });
});
