import { createDb } from "./database/db.js";
import { migrate } from "./database/migrate.js";
import { loadEnv } from "./config/env.js";
import { OutboxProcessor, startNotificationWorker } from "./notifications/outbox-worker.js";
import { TwilioSmsProvider } from "./notifications/twilio-sms-provider.js";
import type { MessagingProvider } from "./notifications/contracts.js";

const env = loadEnv();
const db = createDb(env.DATABASE_URL);
const provider: MessagingProvider =
  env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN
    ? new TwilioSmsProvider(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN)
    : {
        sendMessage: async () => {
          throw new Error("Twilio SMS credentials are not configured");
        },
      };

const start = async () => {
  await migrate(db);
  const worker = startNotificationWorker(db, provider);
  const outbox = new OutboxProcessor(db);
  const poll = async () => { try { await outbox.recoverStuckProcessing(); await outbox.enqueuePending(); } catch (error) { console.error(JSON.stringify({ event: "outbox_poll_failed", error: error instanceof Error ? error.message : "unknown" })); } };
  await poll();
  const timer = setInterval(() => void poll(), 5000);
  const shutdown = async (signal: string) => {
    console.info(JSON.stringify({ event: "worker_shutdown", signal }));
    clearInterval(timer);
    await worker.close();
    await outbox.close();
    await db.end();
    process.exit(0);
  };
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.once("SIGINT", () => void shutdown("SIGINT"));
  console.info(JSON.stringify({ event: "notification_worker_started" }));
};

start().catch(async (error) => {
  console.error(
    JSON.stringify({
      event: "worker_startup_failed",
      error: error instanceof Error ? error.message : "unknown",
    }),
  );
  await db.end();
  process.exit(1);
});
