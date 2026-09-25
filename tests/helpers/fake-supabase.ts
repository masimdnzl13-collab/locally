// Minimal in-memory stand-in for the parts of the supabase-js query builder these flows use.
// It is NOT a Postgres emulator: filters are exact-match, and only the unique constraints a test
// declares are enforced (returning Postgres' 23505 like PostgREST does), because duplicate
// detection in the webhook depends on exactly that.
type Row = Record<string, unknown>;
type Filter = (row: Row) => boolean;

export function createFakeSupabase(options: { tables?: Record<string, Row[]>; unique?: Record<string, string[][]> } = {}) {
  const tables: Record<string, Row[]> = structuredClone(options.tables ?? {});
  const unique = options.unique ?? {};
  const calls: { table: string; op: string; payload?: unknown }[] = [];

  const violatesUnique = (table: string, row: Row, ignore?: Row) =>
    (unique[table] ?? []).some((cols) =>
      (tables[table] ?? []).some((other) => other !== ignore && cols.every((c) => other[c] === row[c])),
    );

  function from(table: string) {
    tables[table] ??= [];
    let op: "select" | "insert" | "upsert" | "update" | "delete" = "select";
    let payload: Row | Row[] | undefined;
    let onConflict: string | undefined;
    const filters: Filter[] = [];
    let limit: number | undefined;
    let mode: "many" | "single" | "maybeSingle" = "many";

    const run = () => {
      calls.push({ table, op, payload });
      const rows = tables[table];
      const matching = () => rows.filter((r) => filters.every((f) => f(r)));
      if (op === "insert") {
        const list = Array.isArray(payload) ? payload : [payload!];
        for (const row of list) {
          if (violatesUnique(table, row)) return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } };
          rows.push({ ...row });
        }
        return { data: list, error: null };
      }
      if (op === "upsert") {
        const row = payload as Row;
        const keys = (onConflict ?? "id").split(",");
        const existing = rows.find((r) => keys.every((k) => r[k] === row[k]));
        if (existing) Object.assign(existing, row);
        else rows.push({ ...row });
        return { data: [row], error: null };
      }
      if (op === "update") {
        const hit = matching();
        hit.forEach((r) => Object.assign(r, payload));
        return { data: hit, error: null };
      }
      if (op === "delete") {
        const hit = matching();
        tables[table] = rows.filter((r) => !hit.includes(r));
        return { data: hit, error: null };
      }
      let result = matching();
      if (limit !== undefined) result = result.slice(0, limit);
      if (mode === "single") return result.length === 1 ? { data: result[0], error: null } : { data: null, error: { code: "PGRST116", message: "not exactly one row" } };
      if (mode === "maybeSingle") return { data: result[0] ?? null, error: null };
      return { data: result, error: null };
    };

    const builder = {
      select: () => builder,
      insert: (p: Row | Row[]) => ((op = "insert"), (payload = p), builder),
      upsert: (p: Row, o?: { onConflict?: string }) => ((op = "upsert"), (payload = p), (onConflict = o?.onConflict), builder),
      update: (p: Row) => ((op = "update"), (payload = p), builder),
      delete: () => ((op = "delete"), builder),
      eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), builder),
      neq: (c: string, v: unknown) => (filters.push((r) => r[c] !== v), builder),
      is: (c: string, v: unknown) => (filters.push((r) => (r[c] ?? null) === v), builder),
      in: (c: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[c])), builder),
      order: () => builder,
      limit: (n: number) => ((limit = n), builder),
      single: () => ((mode = "single"), builder),
      maybeSingle: () => ((mode = "maybeSingle"), builder),
      then: (resolve: (v: ReturnType<typeof run>) => unknown, reject?: (e: unknown) => unknown) => {
        try {
          return Promise.resolve(run()).then(resolve, reject);
        } catch (e) {
          return reject ? reject(e) : Promise.reject(e);
        }
      },
    };
    return builder;
  }

  return { from, tables, calls, rpc: async () => ({ data: null, error: null }) };
}
