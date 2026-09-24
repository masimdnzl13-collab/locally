import { describe, expect, it } from "vitest";
import { withTransaction, type Db, type Tx } from "../src/database/db.js";

describe("transaction isolation", () => {
  it("gives concurrent mutations separate transaction clients", async () => {
    const clients: Tx[] = [];
    const db = {
      async query() { return { rows: [] }; },
      async end() {},
      async connect() {
        const state = { value: "" };
        const client = {
          async query(sql: string) {
            if (sql === "BEGIN") state.value = "begun";
            if (sql === "COMMIT") state.value = "committed";
            return { rows: [], state: state.value };
          },
          release() {},
          state,
        } as unknown as Tx;
        clients.push(client);
        return client;
      },
    } as unknown as Db;

    const entered: string[] = [];
    await Promise.all([
      withTransaction(db, async (tx) => {
        entered.push(String((tx as Tx & { state: { value: string } }).state.value));
        await new Promise((resolve) => setTimeout(resolve, 5));
        (tx as Tx & { state: { value: string } }).state.value = "mutation-a";
      }),
      withTransaction(db, async (tx) => {
        entered.push(String((tx as Tx & { state: { value: string } }).state.value));
        (tx as Tx & { state: { value: string } }).state.value = "mutation-b";
      }),
    ]);

    expect(clients).toHaveLength(2);
    expect(clients[0]).not.toBe(clients[1]);
    expect(entered).toEqual(["begun", "begun"]);
    expect((clients[0] as Tx & { state: { value: string } }).state.value).toBe("committed");
    expect((clients[1] as Tx & { state: { value: string } }).state.value).toBe("committed");
  });
});
