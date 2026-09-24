import { describe, expect, it } from "vitest";
import { NotificationService } from "../src/notifications/notification-service.js";
import type { Db } from "../src/database/db.js";
import { render } from "../src/notifications/templates.js";

describe("PostgreSQL notification processing", () => {
  it("creates and sends an idempotent notification from an outbox event", async () => {
    const calls: string[] = [];
    let notification = { id: "notification-1", status: "QUEUED" };
    const db = {
      query: async (sql: string) => {
        calls.push(sql);
        if (sql.startsWith("SELECT id,restaurant_id"))
          return {
            rows: [
              {
                id: "event-1",
                restaurant_id: "restaurant-1",
                event_type: "RESERVATION_CREATED",
                aggregate_id: "reservation-1",
                payload: { phone: "+15551234567", confirmationCode: "ABC123" },
              },
            ],
          };
        if (sql.startsWith("INSERT INTO notifications"))
          return { rows: [notification] };
        return { rows: [] };
      },
    } as unknown as Db;
    const sent: { to: string; body: string }[] = [];
    const service = new NotificationService(db, {
      sendMessage: async (input) => {
        sent.push(input);
        return { providerMessageId: "provider-1", providerStatus: "sent" };
      },
    });
    await service.process("event-1");
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("+15551234567");
    expect(
      calls.some((sql) =>
        sql.includes("UPDATE outbox_events SET status='PROCESSED'"),
      ),
    ).toBe(true);
  });

  it("renders deterministic English and Spanish transactional templates", () => {
    expect(
      render(
        "RESERVATION_CREATED",
        { restaurantName: "Casa", confirmationCode: "A1" },
        "EN",
      ).text,
    ).toBe("Casa: reservation A1 confirmed.");
    expect(
      render(
        "ORDER_CANCELLED",
        { restaurantName: "Casa", orderNumber: "O2" },
        "ES",
      ).text,
    ).toBe("Casa: pedido O2 cancelada.");
  });

  it("suppresses opted-out customers without calling the provider", async () => {
    const calls: string[] = [];
    const db = {
      query: async (sql: string) => {
        calls.push(sql);
        if (sql.startsWith("SELECT id,restaurant_id"))
          return {
            rows: [
              {
                id: "e",
                restaurant_id: "r",
                event_type: "ORDER_CREATED",
                aggregate_id: "o",
                payload: { phone: "+15551234567" },
              },
            ],
          };
        if (sql.startsWith("SELECT consent,language"))
          return { rows: [{ consent: false, language: "EN" }] };
        return { rows: [] };
      },
    } as unknown as Db;
    let sent = false;
    await new NotificationService(db, {
      sendMessage: async () => {
        sent = true;
        return { providerMessageId: "x", providerStatus: "sent" };
      },
    }).process("e");
    expect(sent).toBe(false);
    expect(calls.some((sql) => sql.includes("PROCESSED"))).toBe(true);
  });
  it("marks an already-sent notification's outbox event processed on retry", async () => {
    const calls: string[] = [];
    const db = { query: async (sql: string) => { calls.push(sql); if (sql.startsWith("SELECT id,restaurant_id")) return { rows: [{ id: "e", restaurant_id: "r", event_type: "ORDER_CREATED", aggregate_id: "o", payload: { phone: "+1" } }] }; if (sql.startsWith("SELECT consent")) return { rows: [] }; if (sql.startsWith("INSERT INTO notifications")) return { rows: [{ id: "n", status: "SENT" }] }; return { rows: [] }; } } as never;
    await new NotificationService(db, { sendMessage: async () => { throw new Error("must not send"); } }).process("e");
    expect(calls.some((sql) => sql.includes("UPDATE outbox_events SET status='PROCESSED'"))).toBe(true);
  });
});
