import { Queue, Worker } from "bullmq";
import type { Db } from "../database/db.js";
import { NotificationService } from "./notification-service.js";
import type { MessagingProvider } from "./contracts.js";
import { safeError } from "../observability.js";
export const notificationQueue = "notifications";
const maxAttempts = 5;
const failureReason = (error: unknown, fallback: string) => error instanceof Error && error.message.length < 200 ? safeError(error) : fallback;
const connection = () => {
  const u = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");
  return {
    host: u.hostname,
    port: Number(u.port || 6379),
    password: u.password || undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
};
export class OutboxProcessor {
  constructor(
    private db: Db,
    private queue = new Queue(notificationQueue, { connection: connection() }),
  ) {}
  async close() { await this.queue.close(); }
  async health() { await this.queue.waitUntilReady(); return true; }
  async enqueuePending() {
    const rows = (
      await this.db.query<{ id: string }>(
        "UPDATE outbox_events SET status='PROCESSING',attempts=attempts+1,available_at=NOW()+INTERVAL '5 minutes' WHERE id IN (SELECT id FROM outbox_events WHERE ((status IN ('PENDING','FAILED') AND available_at<=NOW()) OR (status='PROCESSING' AND available_at<=NOW())) AND attempts < $1 ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 100) RETURNING id",
        [maxAttempts],
      )
    ).rows;
    for (const row of rows) {
      try {
        await this.queue.add("notification", { eventId: row.id }, { jobId: row.id, attempts: maxAttempts, backoff: { type: "exponential", delay: 1000 }, removeOnComplete: 1000, removeOnFail: 1000 });
      } catch (error) {
        await this.db.query("UPDATE outbox_events SET status='FAILED',failure_reason=$2,available_at=NOW()+LEAST(INTERVAL '5 minutes',INTERVAL '1 second' * POWER(2, GREATEST(attempts-1,0))) WHERE id=$1 AND status='PROCESSING'", [row.id, failureReason(error, "queue enqueue failure")]);
        console.error(JSON.stringify({ event:"outbox_enqueue_failed", outboxEventId:row.id, attempt:"unknown", error:safeError(error) }));
      }
    }
    return rows.length;
  }
  async recoverStuckProcessing(): Promise<void> {
    await this.db.query(
      "UPDATE outbox_events SET status='FAILED',failure_reason='worker lease expired',available_at=NOW(),updated_at=NOW() WHERE status='PROCESSING' AND available_at < NOW() RETURNING id",
    );
  }
}
export function startNotificationWorker(db: Db, provider: MessagingProvider) {
  return new Worker(
    notificationQueue,
    async (job) => {
      const eventId = String(job.data.eventId);
      try { return await new NotificationService(db, provider).process(eventId); }
      catch (error) { await db.query("UPDATE outbox_events SET status='FAILED',failure_reason=$2,available_at=NOW()+LEAST(INTERVAL '5 minutes',INTERVAL '1 second' * POWER(2, GREATEST(attempts-1,0))) WHERE id=$1 AND status='PROCESSING'", [eventId, failureReason(error, "notification failure")]); console.error(JSON.stringify({event:"outbox_processing_failed",outboxEventId:eventId,attempt:job.attemptsMade+1,error:safeError(error)})); throw error; }
    },
    { connection: connection(), concurrency: 5, autorun: true, settings: { backoffStrategy: (attemptsMade) => Math.min(60000, 1000 * 2 ** attemptsMade) } },
  );
}
