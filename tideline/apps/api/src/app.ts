import { randomUUID } from "node:crypto";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import Fastify, { type FastifyRequest } from "fastify";
import { z, ZodError } from "zod";
import type { Env } from "./config/env.js";
import type { Db } from "./database/db.js";
import { enterTenant } from "./database/tenant-context.js";
import { AppError } from "./domain/errors.js";
import type { Role, User } from "./domain/types.js";
import { Repositories } from "./repositories/repositories.js";
import { AuthService } from "./services/auth-service.js";
import { RestaurantBrainService } from "./services/restaurant-brain-service.js";
import { StatsService } from "./services/stats-service.js";
import { createVoiceRuntime, type VoiceRuntime } from "./voice/runtime.js";
import { registerFormParser, registerTelephonyRoutes } from "./voice/telephony-routes.js";
import { validateTwilioSignature } from "./voice/twilio-provider.js";
declare module "fastify" {
  interface FastifyRequest {
    requestId: string;
    correlationId: string;
    currentUser?: User;
  }
}
const authBody = z.object({
  email: z.string().email().max(254),
  password: z.string().min(12).max(128),
});
const ssoBody = z.object({ assertion: z.string().min(1).max(4096) });
const restaurantBody = z.object({
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(80),
  timezone: z.string().min(1).max(80).default("UTC"),
});
const twilioStatusBody = z
  .object({
    MessageSid: z.string().trim().min(1).max(64),
    MessageStatus: z
      .enum([
        "queued",
        "sent",
        "delivered",
        "failed",
        "undelivered",
        "received",
      ])
      .optional(),
    SmsStatus: z
      .enum([
        "queued",
        "sent",
        "delivered",
        "failed",
        "undelivered",
        "received",
      ])
      .optional(),
    ErrorCode: z.string().trim().max(32).optional(),
    ErrorMessage: z.string().trim().max(500).optional(),
  })
  .passthrough();
function publicUser(user: User) {
  return { id: user.id, email: user.email, createdAt: user.createdAt };
}
function validTwilioSignature(env: Env, req: FastifyRequest): boolean {
  if (!env.TWILIO_VALIDATE_SIGNATURES || env.APP_ENV === "test") return true;
  const signature = req.headers["x-twilio-signature"];
  if (typeof signature !== "string" || !env.TWILIO_AUTH_TOKEN) return false;
  // Twilio signs the public URL it called, which differs from API_URL behind a tunnel or proxy.
  const url = new URL(req.url, env.VOICE_PUBLIC_URL ?? env.API_URL).toString();
  return validateTwilioSignature(env.TWILIO_AUTH_TOKEN, url, (req.body ?? {}) as Record<string, unknown>, signature);
}
export function createApp(env: Env, db: Db, options: { voice?: VoiceRuntime } = {}) {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      redact: [
        "req.headers.authorization", "req.headers.cookie", "req.headers.x-api-key", "req.body.password", "req.body.token", "req.body.assertion", "req.body.accessToken", "req.body.recording", "req.body.transcript",
        "res.headers.set-cookie",
      ],
    },
    genReqId: (req) => {
      const input = req.headers["x-request-id"];
      return typeof input === "string" && /^[A-Za-z0-9_-]{8,128}$/.test(input)
        ? input
        : randomUUID();
    },
  });
  const repos = new Repositories(db);
  const auth = new AuthService(repos, env.JWT_SECRET);
  const brain = new RestaurantBrainService(db);
  const stats = new StatsService(db);
  app.addHook("onRequest", async (req) => {
    // Do not inherit a previous request's tenant in AsyncLocalStorage.
    enterTenant(undefined);
    req.requestId = req.id;
    const supplied = req.headers["x-correlation-id"];
    req.correlationId = typeof supplied === "string" && /^[A-Za-z0-9_-]{8,128}$/.test(supplied) ? supplied : req.id;
    req.headers["x-request-id"] = req.id;
    const params = req.params as { id?: string; restaurantId?: string };
    enterTenant(params.id ?? params.restaurantId);
    const raw = req.headers.authorization;
    if (raw?.startsWith("Bearer ")) {
      const id = await auth.userId(raw.slice(7));
      const user = await repos.getUser(id);
      if (!user)
        throw new AppError("UNAUTHENTICATED", "Authentication required", 401);
      req.currentUser = user;
    }
  });
  app.addHook("onResponse", async (req, res) => {
    res.header("x-request-id", req.id).header("x-correlation-id", req.correlationId);
    req.log.info(
      {
        requestId: req.id,
        correlationId: req.correlationId,
        route: req.routeOptions.url,
        userId: req.currentUser?.id,
        statusCode: res.statusCode,
      },
      "request complete",
    );
  });
  app.register(cors, {
    origin: env.CORS_ORIGINS.split(",").map((x) => x.trim()),
    credentials: true,
  });
  app.register(rateLimit, { global: false });
  app.register(websocket);
  registerFormParser(app);
  app.setErrorHandler((err, req, res) => {
    const appError =
      err instanceof AppError
        ? err
        : err instanceof ZodError
          ? new AppError("VALIDATION_ERROR", "Invalid request", 400, {
              fields: err.flatten(),
            })
          : new AppError("INTERNAL_ERROR", "An unexpected error occurred", 500);
    req.log.error(
      {
        err,
        requestId: req.id,
        code: appError.code,
        userId: req.currentUser?.id,
      },
      "request failed",
    );
    res.status(appError.statusCode).send({
      error: {
        code: appError.code,
        message: appError.message,
        details: appError.details,
        requestId: req.id,
      },
    });
  });
  const requireUser = (req: FastifyRequest) => {
    if (!req.currentUser)
      throw new AppError("UNAUTHENTICATED", "Authentication required", 401);
    return req.currentUser;
  };
  const role = (roles: Role[]) => async (req: FastifyRequest) => {
    const user = requireUser(req);
    const id = (req.params as { id: string }).id;
    const membership = await repos.membership(user.id, id);
    if (!membership)
      throw new AppError(
        "RESTAURANT_ACCESS_DENIED",
        "Restaurant access denied",
        403,
      );
    if (!roles.includes(membership.role))
      throw new AppError("FORBIDDEN", "Insufficient role", 403);
  };
  app.get("/health", async () => ({ status: "ok" }));
  app.get("/ready", async (req, reply) => {
    try {
      await db.query("SELECT 1");
      return { status: "ready", requestId: req.id };
    } catch (error) {
      req.log.error(
        { event: "readiness_failed", requestId: req.id, correlationId: req.correlationId, error: error instanceof Error ? error.message : "database unavailable" },
        "database readiness failed",
      );
      return reply.code(503).send({ status: "not_ready", requestId: req.id });
    }
  });
  app.post(
    "/api/v1/auth/register",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (req, res) => {
      const body = authBody.parse(req.body);
      const user = await auth.register(body.email, body.password);
      res.status(201);
      return { user: publicUser(user), token: await auth.token(user.id) };
    },
  );
  app.post(
    "/api/v1/auth/login",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (req) => {
      const body = authBody.parse(req.body);
      const out = await auth.login(body.email, body.password);
      return { user: publicUser(out.user), token: out.token };
    },
  );
  app.post(
    "/api/v1/auth/sso",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (req) => {
      const { assertion } = ssoBody.parse(req.body);
      const out = await auth.exchangeSso(assertion);
      return { user: publicUser(out.user), token: out.token, restaurantId: out.restaurantId };
    },
  );
  app.post("/api/v1/auth/logout", async (req) => {
    requireUser(req);
    const authorization=req.headers.authorization;
    if(typeof authorization!=="string"||!authorization.startsWith("Bearer ")) throw new AppError("UNAUTHENTICATED","Authentication required",401);
    await auth.revoke(authorization.slice(7));
    return { ok: true };
  });
  app.get("/api/v1/me", async (req) => {
    const user = requireUser(req);
    return {
      user: publicUser(user),
      restaurants: await repos.restaurantsForUser(user.id),
    };
  });
  app.post("/api/v1/restaurants", async (req, res) => {
    const user = requireUser(req);
    const data = restaurantBody.parse(req.body);
    const restaurant = await repos.createRestaurant(data);
    await repos.addMembership(user.id, restaurant.id, "OWNER");
    res.status(201);
    return { restaurant };
  });
  app.get(
    "/api/v1/restaurants/:id",
    { preHandler: role(["OWNER", "ADMIN", "STAFF"]) },
    async (req) => {
      const user = requireUser(req);
      const restaurant = await repos.restaurantForMember(
        user.id,
        (req.params as { id: string }).id,
      );
      return { restaurant };
    },
  );
  const brainRole = { preHandler: role(["OWNER", "ADMIN", "STAFF"]) };
  const statsRole = { preHandler: role(["OWNER", "ADMIN", "STAFF"]) };
  app.get("/api/v1/restaurants/:id/stats", statsRole, async (req) =>
    stats.overview((req.params as { id: string }).id),
  );
  app.get("/api/v1/restaurants/:id/stats/timeseries", statsRole, async (req) => {
    const days = Math.min(90, Math.max(7, Number((req.query as { days?: string }).days ?? 14)));
    return stats.timeseries((req.params as { id: string }).id, days);
  });
  const listLimit = (req: FastifyRequest) =>
    Math.min(200, Math.max(1, Number((req.query as { limit?: string }).limit ?? 50)));
  app.get("/api/v1/restaurants/:id/calls", statsRole, async (req) => ({
    calls: await stats.recentCalls((req.params as { id: string }).id, listLimit(req)),
  }));
  app.get("/api/v1/restaurants/:id/orders", statsRole, async (req) => ({
    orders: await stats.recentOrders((req.params as { id: string }).id, listLimit(req)),
  }));
  app.get("/api/v1/restaurants/:id/reservations", statsRole, async (req) => ({
    reservations: await stats.recentReservations((req.params as { id: string }).id, listLimit(req)),
  }));
  app.get("/api/v1/restaurants/:id/brain/profile", brainRole, async (req) =>
    brain.profile((req.params as { id: string }).id),
  );
  app.put(
    "/api/v1/restaurants/:id/brain/profile",
    { preHandler: role(["OWNER", "ADMIN"]) },
    async (req) =>
      brain.updateProfile((req.params as { id: string }).id, req.body),
  );
  app.get("/api/v1/restaurants/:id/brain/context", brainRole, async (req) => {
    const id = (req.params as { id: string }).id;
    return {
      restaurant: await brain.profile(id),
      hours: await brain.list(id, "hours"),
      closures: await brain.list(id, "closures"),
      categories: await brain.list(id, "categories"),
      items: await brain.list(id, "items"),
      faqs: await brain.list(id, "faqs"),
    };
  });
  for (const resource of [
    "hours",
    "closures",
    "categories",
    "items",
    "faqs",
  ] as const) {
    app.get(
      `/api/v1/restaurants/:id/brain/${resource}`,
      brainRole,
      async (req) => brain.list((req.params as { id: string }).id, resource),
    );
    app.post(
      `/api/v1/restaurants/:id/brain/${resource}`,
      { preHandler: role(["OWNER", "ADMIN"]) },
      async (req, res) => {
        const value = await brain.create(
          (req.params as { id: string }).id,
          resource,
          req.body,
        );
        res.status(201);
        return value;
      },
    );
    app.patch(
      `/api/v1/restaurants/:id/brain/${resource}/:recordId`,
      { preHandler: role(["OWNER", "ADMIN"]) },
      async (req) =>
        brain.update(
          (req.params as { id: string }).id,
          resource,
          (req.params as { recordId: string }).recordId,
          req.body,
        ),
    );
    app.delete(
      `/api/v1/restaurants/:id/brain/${resource}/:recordId`,
      { preHandler: role(["OWNER", "ADMIN"]) },
      async (req) =>
        brain.remove(
          (req.params as { id: string }).id,
          resource,
          (req.params as { recordId: string }).recordId,
        ),
    );
  }
  app.get(
    "/api/v1/restaurants/:id/brain/settings",
    brainRole,
    async (req) =>
      (
        await db.query(
          "SELECT * FROM restaurant_settings WHERE restaurant_id=$1",
          [(req.params as { id: string }).id],
        )
      ).rows[0] ?? { state: "NOT_CONFIGURED" },
  );
  app.put(
    "/api/v1/restaurants/:id/brain/settings",
    { preHandler: role(["OWNER", "ADMIN"]) },
    async (req) => brain.settings((req.params as { id: string }).id, req.body),
  );
  const notificationRole = { preHandler: role(["OWNER", "ADMIN", "STAFF"]) };
  app.get(
    "/api/v1/restaurants/:id/notifications",
    notificationRole,
    async (req) => {
      const id = (req.params as { id: string }).id;
      return {
        notifications: (
          await db.query(
            "SELECT n.*,m.status AS message_status,m.provider_message_id AS message_provider_message_id,m.error_code,m.error_message AS message_error_message FROM notifications n LEFT JOIN messages m ON m.notification_id=n.id WHERE n.restaurant_id=$1 ORDER BY n.created_at DESC LIMIT 100",
            [id],
          )
        ).rows,
      };
    },
  );
  app.get(
    "/api/v1/restaurants/:id/notifications/preferences",
    notificationRole,
    async (req) => ({
      preferences: (
        await db.query(
          "SELECT phone,consent,language,updated_at FROM customer_sms_preferences WHERE restaurant_id=$1 ORDER BY phone",
          [(req.params as { id: string }).id],
        )
      ).rows,
    }),
  );
  app.put(
    "/api/v1/restaurants/:id/notifications/preferences",
    { preHandler: role(["OWNER", "ADMIN"]) },
    async (req) => {
      const id = (req.params as { id: string }).id;
      const b = z
        .object({
          phone: z.string().min(7).max(32),
          consent: z.boolean(),
          language: z.enum(["EN", "ES"]).default("EN"),
        })
        .parse(req.body);
      await db.query(
        "INSERT INTO customer_sms_preferences(restaurant_id,phone,consent,language) VALUES($1,$2,$3,$4) ON CONFLICT(restaurant_id,phone) DO UPDATE SET consent=EXCLUDED.consent,language=EXCLUDED.language,updated_at=NOW()",
        [id, b.phone, b.consent, b.language],
      );
      return { ok: true };
    },
  );
  app.post(
    "/api/v1/notifications/twilio/status",
    { config: { rateLimit: { max: 120, timeWindow: "1 minute" } } },
    async (req, reply) => {
      if (!validTwilioSignature(env, req))
        return reply.code(403).send({
          error: {
            code: "INVALID_SIGNATURE",
            message: "Invalid Twilio signature",
          },
        });
      const parsed = twilioStatusBody.safeParse(req.body);
      if (!parsed.success)
        return reply
          .code(400)
          .send({
            error: {
              code: "VALIDATION_ERROR",
              message: "Invalid Twilio status payload",
            },
          });
      const b = parsed.data,
        sid = b.MessageSid;
      const status = (
        b.MessageStatus ??
        b.SmsStatus ??
        "unknown"
      ).toLowerCase();
      const messageStatus = status.toUpperCase();
      await db.query(
        "UPDATE messages SET status=CASE WHEN status IN ('DELIVERED','FAILED') THEN status WHEN $2='DELIVERED' THEN 'DELIVERED' WHEN $2 IN ('FAILED','UNDELIVERED') THEN 'FAILED' ELSE status END,error_code=CASE WHEN status IN ('DELIVERED','FAILED') THEN error_code ELSE $3 END,error_message=CASE WHEN status IN ('DELIVERED','FAILED') THEN error_message ELSE $4 END,updated_at=NOW() WHERE provider_message_id=$1",
        [sid, messageStatus, b.ErrorCode ?? null, b.ErrorMessage ?? null],
      );
      await db.query(
        "UPDATE notifications SET provider_status=CASE WHEN status IN ('SENT','FAILED','SUPPRESSED') AND $2 IN ('queued','received') THEN provider_status ELSE $2 END,status=CASE WHEN status IN ('FAILED','SUPPRESSED') THEN status WHEN status='SENT' AND $2 IN ('failed','undelivered') THEN 'SENT' WHEN $2 IN ('delivered','sent') THEN 'SENT' WHEN $2 IN ('failed','undelivered') THEN 'FAILED' ELSE status END,error_message=CASE WHEN status IN ('FAILED','SUPPRESSED') THEN error_message ELSE $3 END WHERE provider_message_id=$1",
        [sid, status, b.ErrorMessage ?? null],
      );
      return { ok: true };
    },
  );
  // Voice: Twilio webhooks + media stream are served by the same production API process.
  app.register(async (voice) => {
    registerTelephonyRoutes(voice, env, options.voice ?? createVoiceRuntime(env, db));
  });
  return app;
}
