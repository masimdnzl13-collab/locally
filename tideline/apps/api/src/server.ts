import { createDb } from "./database/db.js";
import { migrate } from "./database/migrate.js";
import { loadEnv } from "./config/env.js";
import { createApp } from "./app.js";
import { resolveFrameAncestors } from "./config/frame-ancestors.js";

// The API entrypoint serves the authenticated dashboard API and the Twilio voice
// routes (incoming webhook, media WebSocket, status callback) from one process.
const env = loadEnv();
if (resolveFrameAncestors(env.ALLOWED_FRAME_ANCESTORS).isDefault)
  console.warn("ALLOWED_FRAME_ANCESTORS ayarlanmadı, sadece localhost'a izin veriliyor");
const start = async () => {
  const migrationDb = createDb(env.DATABASE_URL);
  try {
    await migrate(migrationDb);
  } finally {
    await migrationDb.end();
  }
  const db = createDb(env.DATABASE_URL);
  const app = createApp(env, db);
  app.addHook("onClose", async () => {
    await db.end();
  });
  const shutdown = async (signal: string) => {
    app.log.info({ event: "api_shutdown", signal }, "API shutdown started");
    try {
      await app.close();
      process.exit(0);
    } catch (error) {
      app.log.error({ event: "api_shutdown_failed", error }, "API shutdown failed");
      process.exit(1);
    }
  };
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.once("SIGINT", () => void shutdown("SIGINT"));
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  app.log.info(
    {
      event: "api_started",
      port: env.PORT,
      telephonyMode: env.TELEPHONY_MODE,
      aiProvider: env.AI_PROVIDER,
      sttProvider: env.STT_PROVIDER,
      ttsProvider: env.TTS_PROVIDER,
    },
    "API started",
  );
};
start().catch((error) => {
  console.error(
    JSON.stringify({
      event: "startup_failed",
      error: error instanceof Error ? error.message : "unknown",
    }),
  );
  process.exit(1);
});
