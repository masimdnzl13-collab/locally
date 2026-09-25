import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Env } from "../config/env.js";
import type { Db } from "../database/db.js";
import { enterTenant } from "../database/tenant-context.js";
import { registerFormParser, twilioRequestIsValid } from "../voice/telephony-routes.js";
import { setSmsConsent } from "./sms-consent.js";
import { smsKeyword, toE164, type SmsKeyword } from "./sms-keywords.js";

const inboundSmsBody = z
  .object({
    From: z.string().trim().min(3).max(32),
    To: z.string().trim().min(3).max(32),
    Body: z.string().max(1600).optional(),
    OptOutType: z.string().trim().max(16).optional(),
  })
  .passthrough();

const twiml = (message?: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><Response>${message ? `<Message>${message.replace(/[<>&]/g, "")}</Message>` : ""}</Response>`;

// Only sent when SMS_OPT_OUT_REPLIES=app. By default Twilio's own opt-out handling (always on for
// long codes) already answers STOP/START/HELP; answering again would double-text the customer.
const replies: Record<SmsKeyword, (restaurant: string) => string> = {
  STOP: (r) => `You're unsubscribed from ${r} texts and won't receive more messages. Reply START to resubscribe.`,
  START: (r) => `You're resubscribed to ${r} texts (order and reservation updates). Msg&data rates may apply. Reply STOP to opt out, HELP for help.`,
  HELP: (r) => `${r}: order and reservation updates. Msg&data rates may apply. Reply STOP to opt out. Call this number for help.`,
};

/**
 * Inbound SMS to a restaurant's Twilio number (the number's SmsUrl, set at purchase in
 * phone-provisioning-service.ts). STOP-family keywords turn SMS consent off for that
 * customer at that restaurant; START turns it back on. Nothing else is done with inbound texts.
 */
export function registerSmsInboundRoutes(app: FastifyInstance, env: Env, db: Db) {
  registerFormParser(app);
  app.post(
    "/api/v1/telephony/twilio/sms",
    { config: { rateLimit: { max: 120, timeWindow: "1 minute" } } },
    async (request, reply) => {
      enterTenant(undefined);
      if (!twilioRequestIsValid(env, request)) return reply.code(403).type("text/xml").send(twiml());
      const parsed = inboundSmsBody.safeParse(request.body);
      if (!parsed.success) return reply.code(400).type("text/xml").send(twiml());
      const keyword = smsKeyword(parsed.data.Body, parsed.data.OptOutType);
      if (!keyword) return reply.type("text/xml").send(twiml());
      const restaurant = (
        await db.query<{ id: string; name: string }>(
          "SELECT r.id,r.name FROM restaurant_phone_numbers p JOIN restaurants r ON r.id=p.restaurant_id WHERE p.phone_number=$1 AND p.active=true",
          [toE164(parsed.data.To)],
        )
      ).rows[0];
      if (!restaurant) {
        // Twilio still blocks this sender→recipient pair itself; we just have nothing to record against.
        request.log.warn({ keyword }, "sms keyword to a number with no active restaurant");
        return reply.type("text/xml").send(twiml());
      }
      enterTenant(restaurant.id);
      if (keyword !== "HELP")
        await setSmsConsent(db, { restaurantId: restaurant.id, phone: parsed.data.From, consent: keyword === "START", source: "sms_keyword" });
      request.log.info({ restaurantId: restaurant.id, keyword }, "sms keyword processed");
      return reply
        .type("text/xml")
        .send(twiml(env.SMS_OPT_OUT_REPLIES === "app" ? replies[keyword](restaurant.name) : undefined));
    },
  );
}
