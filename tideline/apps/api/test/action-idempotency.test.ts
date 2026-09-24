import { describe, expect, it } from "vitest";
import { ActionRegistry } from "../src/ai/action-registry.js";
import type { Db } from "../src/database/db.js";

const rid = "00000000-0000-0000-0000-000000000001";
const confirmation = "00000000-0000-0000-0000-000000000002";
const brain = { greeting: {}, hours: {}, menu: [], policies: {}, seasonalStatus: "ACTIVE", seasonalClosedMessage: {}, humanTransfer: {} } as never;
const input = { customerName: "A", customerPhone: "+15551234567", orderType: "PICKUP", items: [{ menuItemId: "00000000-0000-0000-0000-000000000003", quantity: 1, modifiers: [] }], confirmationId: confirmation };

function harness() {
  const rows = new Map<string, any>(); let executions = 0; let fail = false; let transactionClaimKey = "";
  const db = { query: async (sql: string, values: any[] = []) => {
    const key = `${values[0]}:${values[1]}:${values[2]}`;
    if (sql === "ROLLBACK") { if (transactionClaimKey) rows.delete(transactionClaimKey); transactionClaimKey = ""; return { rows: [] }; }
    if (sql === "COMMIT") { transactionClaimKey = ""; return { rows: [] }; }
    if (sql.startsWith("INSERT INTO action_idempotency")) {
      const existing = rows.get(key);
      if (!existing || (existing.status === "PROCESSING" && existing.stale)) { const row = { response: null, status: "PROCESSING", action: values[1], claimId: values[3] }; rows.set(key, row); transactionClaimKey = key; return { rows: [row] }; }
      return { rows: [] };
    }
    if (sql.startsWith("SELECT response,status,action")) { const row = rows.get(key); return { rows: row ? [{ response: row.response, status: row.status, action: row.action }] : [] }; }
    if (sql.startsWith("UPDATE action_idempotency")) { const row = rows.get(key); if (row?.claimId === values[4]) { row.status = "COMPLETED"; row.response = JSON.parse(values[3]); row.lease = null; } return { rows: [] }; }
    if (sql.startsWith("DELETE FROM action_idempotency")) { const row = rows.get(key); if (row?.claimId === values[3]) rows.delete(key); return { rows: [] }; }
    return { rows: [] };
  }, connect: async () => ({ query: (sql: string, values?: any[]) => db.query(sql, values), release: () => {} }), end: async () => {} } as unknown as Db;
  const orders = { create: async () => { executions++; if (fail) throw new Error("boom"); return { success: true, order: { id: "o1" } }; } } as never;
  const registry = new ActionRegistry(db, undefined, orders);
  return { db, registry, rows, executions, setFail: (v: boolean) => { fail = v; }, count: () => executions };
}

describe("action idempotency claims", () => {
  it("executes concurrent identical mutations once and replays success", async () => {
    const h = harness(); const c = { restaurantId: rid, actorType: "AI" as const, idempotencyKey: "same" };
    const results = await Promise.allSettled([h.registry.execute("create_order", input, brain, c), h.registry.execute("create_order", input, brain, c)]);
    expect(h.count()).toBe(1); expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    await expect(h.registry.execute("create_order", input, brain, c)).resolves.toMatchObject({ success: true });
  });
  it("releases a failed claim so a retry can execute", async () => {
    const h = harness(); h.setFail(true); const c = { restaurantId: rid, actorType: "AI" as const, idempotencyKey: "failed" };
    await expect(h.registry.execute("create_order", input, brain, c)).rejects.toThrow(); h.setFail(false);
    await expect(h.registry.execute("create_order", input, brain, c)).resolves.toMatchObject({ success: true }); expect(h.count()).toBe(2);
  });
  it("reclaims stale claims but does not reclaim live claims", async () => {
    const h = harness(); const c = { restaurantId: rid, actorType: "AI" as const, idempotencyKey: "stale" };
    h.rows.set(`${rid}:create_order:stale`, { status: "PROCESSING", action: "create_order", claimId: "old", stale: true });
    await expect(h.registry.execute("create_order", input, brain, c)).resolves.toMatchObject({ success: true });
    h.rows.set(`${rid}:create_order:live`, { status: "PROCESSING", action: "create_order", claimId: "live", stale: false });
    await expect(h.registry.execute("create_order", { ...input, confirmationId: confirmation }, brain, { ...c, idempotencyKey: "live" })).rejects.toMatchObject({ code: "ACTION_IN_PROGRESS" });
  });
  it("isolates tenants and actions sharing the same key", async () => {
    const h = harness(); const a = { restaurantId: rid, actorType: "AI" as const, idempotencyKey: "shared" }; const b = { ...a, restaurantId: "00000000-0000-0000-0000-000000000004" };
    await expect(h.registry.execute("create_order", input, brain, a)).resolves.toMatchObject({ success: true });
    await expect(h.registry.execute("create_order", input, brain, b)).resolves.toMatchObject({ success: true });
    expect(h.count()).toBe(2);
  });
});
