import { randomUUID } from "node:crypto";
import type { Db } from "../database/db.js";
import type { MessagingProvider, NotificationEvent } from "./contracts.js";
import { render } from "./templates.js";
import { safeError } from "../observability.js";
export class NotificationService {
  constructor(
    private db: Db,
    private provider: MessagingProvider,
  ) {}
  async process(eventId: string) {
    const e = (
      await this.db.query<{
        id: string;
        restaurant_id: string;
        event_type: NotificationEvent;
        aggregate_id: string;
        payload: Record<string, unknown>;
      }>(
        "SELECT id,restaurant_id,event_type,aggregate_id,payload FROM outbox_events WHERE id=$1",
        [eventId],
      )
    ).rows[0];
    if (!e) return;
    const payload = e.payload ?? {},
      phone = String(payload.phone ?? "");
    if (!phone) {
      await this.db.query(
        "UPDATE outbox_events SET status='PROCESSED',processed_at=NOW() WHERE id=$1",
        [eventId],
      );
      return;
    }
    const preference = (
      await this.db.query<{ consent: boolean; language: "EN" | "ES" }>(
        "SELECT consent,language FROM customer_sms_preferences WHERE restaurant_id=$1 AND phone=$2",
        [e.restaurant_id, phone],
      )
    ).rows[0];
    if (preference && !preference.consent) {
      await this.db.query(
        "UPDATE outbox_events SET status='PROCESSED',processed_at=NOW() WHERE id=$1",
        [eventId],
      );
      return { status: "SUPPRESSED" };
    }
    const key = `${e.restaurant_id}:${e.event_type}:${e.aggregate_id}`,
      body = render(e.event_type, payload, preference?.language ?? "EN").text;
    const n = (
      await this.db.query<{ id: string; status: string }>(
        "INSERT INTO notifications(id,restaurant_id,outbox_event_id,event_type,recipient_phone,idempotency_key,body) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(idempotency_key) DO UPDATE SET idempotency_key=EXCLUDED.idempotency_key RETURNING id,status",
        [randomUUID(), e.restaurant_id, e.id, e.event_type, phone, key, body],
      )
    ).rows[0];
    if (n.status === "SENT" || n.status === "SUPPRESSED") {
      await this.db.query(
        "UPDATE outbox_events SET status='PROCESSED',processed_at=COALESCE(processed_at,NOW()) WHERE id=$1 AND status <> 'PROCESSED'",
        [eventId],
      );
      return n;
    }
    const messageId = randomUUID();
    const existingMessage = (await this.db.query<{ id: string; status: string }>(
      "SELECT id,status FROM messages WHERE notification_id=$1 ORDER BY created_at DESC LIMIT 1 FOR UPDATE",
      [n.id],
    )).rows[0];
    if (existingMessage && ["SENT", "DELIVERED"].includes(existingMessage.status)) {
      await this.db.query("UPDATE outbox_events SET status='PROCESSED',processed_at=COALESCE(processed_at,NOW()) WHERE id=$1", [eventId]);
      return n;
    }
    if (existingMessage && existingMessage.status === "SENDING") return n;
    const activeMessageId = existingMessage?.id ?? messageId;
    if (!existingMessage) await this.db.query(
      "INSERT INTO messages(id,restaurant_id,notification_id,status) VALUES($1,$2,$3,'SENDING') ON CONFLICT(notification_id) DO NOTHING",
      [activeMessageId, e.restaurant_id, n.id],
    ); else await this.db.query("UPDATE messages SET status='SENDING',error_message=NULL,error_code=NULL,updated_at=NOW() WHERE id=$1 AND status='FAILED'", [activeMessageId]);
    try {
      const sent = await this.provider.sendMessage({
        to: phone,
        from: String(payload.from ?? ""),
        body,
      });
      await this.db.query(
        "UPDATE messages SET provider_message_id=$2,status='SENT',updated_at=NOW() WHERE id=$1",
        [activeMessageId, sent.providerMessageId],
      );
      await this.db.query(
        "UPDATE notifications SET status='SENT',provider_message_id=$2,provider_status=$3,sent_at=NOW() WHERE id=$1",
        [n.id, sent.providerMessageId, sent.providerStatus],
      );
      await this.db.query(
        "UPDATE outbox_events SET status='PROCESSED',processed_at=NOW() WHERE id=$1",
        [eventId],
      );
      return n;
    } catch (error) {
      const message = "notification provider failure";
      await this.db.query(
        "UPDATE messages SET status='FAILED',error_message=$2,error_code='PROVIDER_ERROR',updated_at=NOW() WHERE id=$1",
        [activeMessageId, message],
      );
      await this.db.query(
        "UPDATE notifications SET status='FAILED',error_message=$2 WHERE id=$1",
        [n.id, message],
      );
      console.error(JSON.stringify({ event: "notification_provider_failed", restaurantId: e.restaurant_id, eventType: e.event_type, outboxEventId: eventId, notificationId: n.id, retryable: true, error: safeError(error) }));
      throw error;
    }
  }
}
