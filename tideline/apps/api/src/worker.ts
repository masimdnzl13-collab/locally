import { createDb } from "./database/db.js";
import { migrate } from "./database/migrate.js";
import { loadEnv } from "./config/env.js";
import { safeError } from "./observability.js";
import { OutboxProcessor, startNotificationWorker } from "./notifications/outbox-worker.js";
import { TwilioSmsProvider } from "./notifications/twilio-sms-provider.js";
import type { MessagingProvider } from "./notifications/contracts.js";
import { createAlertNotifier } from "./alerts/notifier.js";
import { CostGuard, CostService, costRatesFromEnv, notifyAdminAction } from "./services/cost-service.js";

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
  const poll = async () => { try { await outbox.recoverStuckProcessing(); await outbox.enqueuePending(); } catch (error) { console.error(JSON.stringify({ event: "outbox_poll_failed", error: safeError(error) })); } };
  await poll();
  const timer = setInterval(() => void poll(), 5000);
  // Cost guard: hourly month-to-date check; alerts only, never suspends a restaurant.
  const log = {
    warn: (obj: object, msg: string) => console.warn(JSON.stringify({ ...obj, msg })),
    error: (obj: object, msg: string) => console.error(JSON.stringify({ ...obj, msg })),
  };
  const costGuard = new CostGuard(db, new CostService(db, costRatesFromEnv(env)), [
    notifyAdminAction(createAlertNotifier(env, log)),
  ]);
  const checkCosts = async () => {
    try {
      const result = await costGuard.run();
      if (result.fired.length) console.info(JSON.stringify({ event: "cost_guard_fired", ...result }));
    } catch (error) {
      console.error(JSON.stringify({ event: "cost_guard_failed", error: safeError(error) }));
    }
  };
  void checkCosts();
  const costTimer = setInterval(() => void checkCosts(), 60 * 60 * 1000);
  const shutdown = async (signal: string) => {
    console.info(JSON.stringify({ event: "worker_shutdown", signal }));
    clearInterval(timer);
    clearInterval(costTimer);
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
