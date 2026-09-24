import { describe, expect, it, vi } from "vitest";
import { safeError, writeAudit } from "../src/observability.js";

describe("observability", () => {
  it("redacts error line breaks and bounds provider detail", () => {
    expect(safeError(new Error("token=secret\nAuthorization: Bearer jwt"))).toBe("token=secret Authorization: Bearer jwt");
  });
  it("keeps audit failures isolated from the business operation", async () => {
    const db = { query: vi.fn().mockRejectedValue(new Error("database unavailable")) } as never;
    await expect(writeAudit(db, { restaurantId: "tenant-a", action: "CREATE_ORDER", entityType: "AI_ACTION", actorType: "AI", correlationId: "corr-1", result: "FAILED" })).resolves.toBeUndefined();
  });
  it("writes tenant and correlation context without sensitive payloads", async () => {
    const query = vi.fn().mockResolvedValue({});
    await writeAudit({ query } as never, { restaurantId: "tenant-a", action: "CREATE_RESERVATION", entityType: "RESERVATION", actorType: "AI", correlationId: "corr-1", result: "SUCCESS", metadata: { turnId: "turn-1" } });
    expect(query.mock.calls[0][1]).toContain("tenant-a");
    expect(query.mock.calls[0][1]).toContain("corr-1");
    expect(JSON.stringify(query.mock.calls[0][1])).not.toMatch(/password|authorization|jwt|recording/i);
  });
});
