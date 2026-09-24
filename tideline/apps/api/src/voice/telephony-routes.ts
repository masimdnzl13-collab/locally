import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { Env } from "../config/env.js";
import { enterTenant } from "../database/tenant-context.js";
import type { VoiceRuntime } from "./runtime.js";
import { validateTwilioSignature } from "./twilio-provider.js";
type RawData = Buffer | string | Buffer[];

const xml = (body: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><Response><Say>${body.replace(/[<>&]/g, "")}</Say><Hangup/></Response>`;
const twilioCallStatusBody = z
  .object({
    CallSid: z.string().trim().min(1).max(64),
    CallStatus: z
      .enum(["queued", "ringing", "in-progress", "in_progress", "completed", "failed", "no-answer", "no_answer", "busy", "canceled"])
      .optional(),
    ErrorMessage: z.string().trim().max(500).optional(),
  })
  .passthrough();
const twilioIncomingBody = z
  .object({
    To: z.string().trim().min(3).max(32),
    CallSid: z.string().trim().min(1).max(64),
    From: z.string().trim().max(32).optional(),
  })
  .passthrough();
const testEventBody = z.object({
  type: z.enum(["audio", "transcript", "stop"]),
  audio: z.string().optional(),
  transcript: z.string().max(2000).optional(),
});

/** Twilio webhooks are form-encoded; Fastify only parses JSON by default. */
export function registerFormParser(app: FastifyInstance) {
  if (app.hasContentTypeParser("application/x-www-form-urlencoded")) return;
  app.addContentTypeParser(
    "application/x-www-form-urlencoded",
    { parseAs: "string", bodyLimit: 64 * 1024 },
    (_req, body, done) => done(null, Object.fromEntries(new URLSearchParams(body as string))),
  );
}
/** Validates X-Twilio-Signature against the public URL Twilio called. */
export function twilioRequestIsValid(env: Env, request: FastifyRequest): boolean {
  if (env.TELEPHONY_MODE === "test" || !env.TWILIO_VALIDATE_SIGNATURES) return true;
  if (!env.TWILIO_AUTH_TOKEN) return false;
  const signature = request.headers["x-twilio-signature"];
  const url = new URL(request.url, env.VOICE_PUBLIC_URL ?? env.API_URL).toString();
  return validateTwilioSignature(
    env.TWILIO_AUTH_TOKEN,
    url,
    (request.body ?? {}) as Record<string, unknown>,
    typeof signature === "string" ? signature : undefined,
  );
}

/**
 * Voice routes: Twilio incoming-call webhook, bidirectional media WebSocket,
 * call status callback, and (test mode only) a transcript injection endpoint.
 * Requires @fastify/websocket to be registered on the app.
 */
export function registerTelephonyRoutes(app: FastifyInstance, env: Env, runtime: VoiceRuntime) {
  const { repo, telephony, manager } = runtime;
  const streamPath = env.VOICE_STREAM_PATH || "/api/v1/telephony/twilio/media";
  registerFormParser(app);
  app.get(streamPath, { websocket: true }, (socket, request) => {
    let sessionId = String((request.query as { sessionId?: string }).sessionId ?? "");
    let streamSid = "";
    let attached = false;
    const media = {
      sendAudio: async (audio: Buffer) => {
        if (socket.readyState !== 1 || !streamSid) return;
        // 1 s chunks keep individual frames small; `clear` still flushes everything queued.
        for (let offset = 0; offset < audio.length; offset += 8000)
          socket.send(JSON.stringify({ event: "media", streamSid, media: { payload: audio.subarray(offset, offset + 8000).toString("base64") } }));
      },
      clear: async () => {
        if (socket.readyState === 1 && streamSid) socket.send(JSON.stringify({ event: "clear", streamSid }));
      },
      close: async () => {
        if (socket.readyState === 1) socket.close();
      },
    };
    const attach = () => {
      if (attached || !sessionId) return;
      manager.attachMedia(sessionId, media);
      attached = true;
    };
    socket.on("message", async (raw: RawData) => {
      try {
        const message = JSON.parse(raw.toString()) as {
          event: string;
          start?: { streamSid?: string; customParameters?: Record<string, string> };
          streamSid?: string;
          media?: { payload: string; track?: string };
        };
        if (message.event === "start") {
          streamSid = message.start?.streamSid ?? message.streamSid ?? "";
          sessionId = message.start?.customParameters?.sessionId ?? sessionId;
          attach();
          if (!attached) socket.close(1008, "sessionId required");
        }
        if (message.event === "media" && message.media?.payload && attached && message.media.track !== "outbound")
          await manager.audio(sessionId, Buffer.from(message.media.payload, "base64"));
        if (message.event === "stop" && attached) await manager.end(sessionId, "MEDIA_STOP");
      } catch (error) {
        app.log.warn({ error, sessionId }, "media stream message failed");
        socket.close(1011, "media processing failed");
      }
    });
    socket.on("close", () => {
      if (!attached) return;
      void manager.end(sessionId, "MEDIA_DISCONNECTED").catch((error) => {
        app.log.error({ error, sessionId }, "voice session cleanup failed");
      });
    });
  });
  app.post(
    "/api/v1/telephony/twilio/incoming",
    { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (request, reply) => {
      enterTenant(undefined);
      if (!twilioRequestIsValid(env, request))
        return reply.code(403).type("text/xml").send(xml("We could not verify this call."));
      const parsed = twilioIncomingBody.safeParse(request.body);
      if (!parsed.success)
        return reply.code(400).type("text/xml").send(xml("We could not process this call."));
      const called = parsed.data.To.trim(),
        providerId = parsed.data.CallSid.trim();
      const restaurant = await repo.resolveActivePhone(called);
      if (!restaurant)
        return reply.code(404).type("text/xml").send(xml("This number is not configured."));
      enterTenant(restaurant.restaurantId);
      const config = (restaurant.voiceConfig ?? {}) as {
        closedMessage?: string;
        greetingEn?: string;
        transferNumber?: string;
      };
      if (restaurant.status !== "ACTIVE")
        return reply.type("text/xml").send(xml(config.closedMessage ?? "Thank you for calling. We are currently closed."));
      const { call, created } = await repo.createCall({
        restaurantId: restaurant.restaurantId,
        provider: "twilio",
        providerCallId: providerId,
        caller: parsed.data.From ?? undefined,
        called,
      });
      const session = await repo.createSession(call);
      if (created)
        await repo.event({
          callId: call.id,
          sessionId: session.id,
          restaurantId: restaurant.restaurantId,
          type: "CALL_STARTED",
          providerEventId: `incoming:${providerId}`,
        });
      const restaurantContext = await repo.restaurantContext(restaurant.restaurantId);
      await manager.begin(session, call.id, restaurant.restaurantId, {
        ...restaurantContext,
        providerCallId: providerId,
        callerPhone: parsed.data.From,
      });
      const greeting =
        config.greetingEn ??
        `Thank you for calling ${restaurant.restaurantName}. How can I help you today?`;
      const root = env.VOICE_PUBLIC_URL ?? env.API_URL;
      return reply.type("text/xml").send(
        telephony.incomingResponse({
          streamUrl: `${root.replace(/\/$/, "").replace(/^http/, "ws")}${streamPath}`,
          greeting,
          transferNumber: config.transferNumber,
          parameters: { sessionId: session.id },
        }),
      );
    },
  );
  app.post(
    "/api/v1/telephony/twilio/status",
    { config: { rateLimit: { max: 120, timeWindow: "1 minute" } } },
    async (request, reply) => {
      enterTenant(undefined);
      if (!twilioRequestIsValid(env, request)) return reply.code(403).send();
      const parsed = twilioCallStatusBody.safeParse(request.body);
      if (!parsed.success)
        return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "Invalid Twilio status payload" } });
      const rawStatus = parsed.data.CallStatus?.trim().toLowerCase().replaceAll("-", "_");
      const statusMap = {
        ringing: "RINGING",
        in_progress: "IN_PROGRESS",
        completed: "COMPLETED",
        failed: "FAILED",
        no_answer: "NO_ANSWER",
        busy: "BUSY",
        canceled: "NO_ANSWER",
      } as const;
      if (rawStatus && rawStatus in statusMap)
        await repo.updateProviderStatus(
          "twilio",
          parsed.data.CallSid.trim(),
          statusMap[rawStatus as keyof typeof statusMap],
          parsed.data.ErrorMessage ?? undefined,
        );
      return reply.code(204).send();
    },
  );
  if (env.TELEPHONY_MODE === "test")
    app.post("/api/v1/telephony/test/sessions/:sessionId/events", async (request, reply) => {
      enterTenant(undefined);
      const body = testEventBody.parse(request.body);
      const sessionId = (request.params as { sessionId: string }).sessionId;
      if (body.type === "audio" && body.audio) await manager.audio(sessionId, Buffer.from(body.audio, "base64"));
      else if (body.type === "transcript" && body.transcript) await manager.transcript(sessionId, body.transcript);
      else if (body.type === "stop") await manager.end(sessionId, "MEDIA_STOP");
      return reply.code(204).send();
    });
}
