import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase } from "./helpers/fake-supabase";
import { POST } from "@/app/api/webhooks/twilio/sms/route";
import { notificationService } from "@/lib/notifications/service";
import { addModule } from "@/lib/modules/seasonal";
import { sendAnnouncementAction } from "@/lib/announcements/actions";
import { smsKeyword } from "@/lib/notifications/sms-keywords";
import { phoneKey } from "@/lib/notifications/sms-opt-out";

// AM — TCPA opt-out on Locally's own Twilio number: after a STOP, no SMS of any kind (seasonal
// module notice, owner announcements, anything else through notificationService) is sent to that
// number until it texts START. Mocked: Supabase (in-memory fake), fetch (Twilio API), and the
// cookie/session helpers the announcement action needs. NOT mocked: the webhook, its signature
// check, the opt-out lookup and the send path.

const AUTH_TOKEN = "twilio-test-token";
const WEBHOOK_URL = "https://locally.test/api/webhooks/twilio/sms";
process.env.TWILIO_ACCOUNT_SID = "AC-test";
process.env.TWILIO_AUTH_TOKEN = AUTH_TOKEN;
process.env.TWILIO_FROM_NUMBER = "+15550009999";
process.env.TWILIO_SMS_WEBHOOK_URL = WEBHOOK_URL;
delete process.env.RESEND_API_KEY;

const state = vi.hoisted(() => ({
  db: null as ReturnType<typeof import("./helpers/fake-supabase").createFakeSupabase> | null,
  twilio: [] as { to: string; body: string }[],
  twilioError: null as null | { status: number; code: number; message: string },
  recipients: [] as { full_name: string | null; phone: string; email: string | null }[],
}));

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => state.db }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    // The fake has no range filters; "already sent today" never matches in these tests anyway.
    from: (table: string) => Object.assign(state.db!.from(table), { gte() { return this; } }),
    rpc: async (name: string) => (name === "get_segment_recipients" ? { data: state.recipients, error: null } : { data: null, error: null }),
  }),
}));
vi.mock("@/lib/business/current", () => ({ getMyBusiness: async () => ({ id: "biz-1", name: "Harbor Grill" }) }));
vi.mock("@/lib/announcements/time", () => ({ isNightHours: () => false, startOfIstanbulDayUtcIso: () => "2026-09-26T00:00:00Z" }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

vi.stubGlobal("fetch", async (input: string | URL, init?: RequestInit) => {
  const url = String(input);
  if (!url.startsWith("https://api.twilio.com/")) return new Response("unexpected", { status: 500 });
  const form = new URLSearchParams(String(init?.body ?? ""));
  if (state.twilioError) {
    const { status, code, message } = state.twilioError;
    return new Response(JSON.stringify({ code, message }), { status });
  }
  state.twilio.push({ to: form.get("To")!, body: form.get("Body")! });
  return new Response(JSON.stringify({ sid: `SM${state.twilio.length}` }), { status: 201 });
});


const OWNER = "+14155550123";

function inbound(body: string, opts: { from?: string; signature?: string } = {}) {
  const params = new URLSearchParams({ AccountSid: "AC-test", Body: body, From: opts.from ?? OWNER, MessageSid: "SMin", To: "+15550009999" });
  const payload = WEBHOOK_URL + Array.from(params.keys()).sort().map((k) => k + params.get(k)).join("");
  const signature = opts.signature ?? createHmac("sha1", AUTH_TOKEN).update(payload).digest("base64");
  return POST(
    new Request(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Twilio-Signature": signature },
      body: params.toString(),
    }),
  );
}

function withSeasonalRpc() {
  (state.db as unknown as { rpc: unknown }).rpc = async () => ({ data: [{ business_id: "biz-1" }], error: null });
}

beforeEach(() => {
  state.db = createFakeSupabase({
    tables: {
      sms_opt_outs: [],
      businesses: [{ id: "biz-1", owner_id: "user-1", phone: "+1 (415) 555-0123", market: "US" }],
      business_module_events: [],
      announcements: [],
    },
  });
  state.twilio = [];
  state.twilioError = null;
  state.recipients = [{ full_name: "Sam", phone: "+1 415 555 0123", email: null }];
});

describe("SMS keywords", () => {
  it("counts only a whole-message keyword", () => {
    expect(smsKeyword("Stop")).toBe("STOP");
    expect(smsKeyword("STOP ALL")).toBe("STOP");
    expect(smsKeyword("cancelar")).toBe("STOP");
    expect(smsKeyword("start")).toBe("START");
    expect(smsKeyword("help")).toBe("HELP");
    expect(smsKeyword("please stop calling me at work")).toBeNull();
    expect(smsKeyword("anything", "STOP")).toBe("STOP");
  });
  it("keys one person the same way however the number is written", () => {
    expect(phoneKey("+1 (415) 555-0123")).toBe("14155550123");
    expect(phoneKey("14155550123")).toBe("14155550123");
    expect(phoneKey("0532 111 22 33")).toBe("905321112233");
  });
});

describe("Twilio SMS opt-out", () => {
  it("after STOP, sends no SMS of any type until START", async () => {
    const before = await notificationService.sendSms({ to: OWNER, message: "hello" });
    expect(before).toMatchObject({ success: true, simulated: false });
    expect(state.twilio).toHaveLength(1);

    const stop = await inbound("STOP");
    expect(stop.status).toBe(200);
    // Twilio's default opt-out already answered; an empty TwiML avoids a second text.
    expect(await stop.text()).toBe('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    expect(state.db!.tables.sms_opt_outs).toMatchObject([{ phone_digits: "14155550123", opted_out: true, source: "sms_keyword", last_keyword: "STOP" }]);

    // Direct send, however the number is written.
    expect(await notificationService.sendSms({ to: "(415) 555-0123", message: "x" })).toMatchObject({ success: false, suppressed: true });
    expect(await notificationService.sendSms({ to: "14155550123", message: "x" })).toMatchObject({ success: false, suppressed: true });

    // Seasonal module notice (the business's phone is stored as "+1 (415) 555-0123").
    withSeasonalRpc();
    const seasonal = await addModule(["biz-1"], "locally_core", "cron");
    expect(seasonal.notified).toBe(0);
    expect(state.db!.tables.business_module_events[0]).toMatchObject({ notification_channel: "sms", notification_status: "failed" });

    // Owner announcement to a customer segment.
    const form = new FormData();
    form.set("channel", "sms");
    form.set("content", "Pumpkin pie is back this weekend!");
    const announcement = await sendAnnouncementAction(form);
    expect(announcement).toMatchObject({ success: true, recipientCount: 0 });

    expect(state.twilio).toHaveLength(1);

    // HELP changes nothing; START resubscribes.
    await inbound("help");
    expect(await notificationService.sendSms({ to: OWNER, message: "x" })).toMatchObject({ suppressed: true });
    await inbound("START");
    expect(state.db!.tables.sms_opt_outs[0]).toMatchObject({ opted_out: false, opted_out_at: null });
    expect(await notificationService.sendSms({ to: OWNER, message: "back" })).toMatchObject({ success: true });
    expect(state.twilio).toHaveLength(2);
  });

  it("records Twilio's 21610 refusal and does not try that number again", async () => {
    state.twilioError = { status: 400, code: 21610, message: "Attempt to send to unsubscribed recipient" };
    expect(await notificationService.sendSms({ to: OWNER, message: "x" })).toMatchObject({ success: false, suppressed: true });
    expect(state.db!.tables.sms_opt_outs).toMatchObject([{ phone_digits: "14155550123", opted_out: true, source: "carrier" }]);
    state.twilioError = null;
    expect(await notificationService.sendSms({ to: OWNER, message: "x" })).toMatchObject({ suppressed: true });
    expect(state.twilio).toHaveLength(0);
  });

  it("does not send when the opt-out list cannot be read", async () => {
    state.db = { from: () => ({ select: () => ({ in: () => ({ eq: () => ({ limit: async () => ({ data: null, error: { message: "down" } }) }) }) }) }) } as never;
    const result = await notificationService.sendSms({ to: OWNER, message: "x" });
    expect(result).toMatchObject({ success: false, simulated: false });
    expect(state.twilio).toHaveLength(0);
  });

  it("rejects a forged webhook and ignores ordinary texts", async () => {
    const forged = await inbound("STOP", { signature: "bm90LWEtcmVhbC1zaWduYXR1cmU=" });
    expect(forged.status).toBe(403);
    expect(await inbound("See you at 7!")).toHaveProperty("status", 200);
    expect(state.db!.tables.sms_opt_outs).toEqual([]);
  });

  it("answers the keyword itself only when TWILIO_OPT_OUT_REPLIES=app", async () => {
    process.env.TWILIO_OPT_OUT_REPLIES = "app";
    try {
      expect(await (await inbound("STOP")).text()).toContain("<Message>Locally: You're unsubscribed");
    } finally {
      delete process.env.TWILIO_OPT_OUT_REPLIES;
    }
  });
});
