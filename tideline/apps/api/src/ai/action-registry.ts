import { z } from "zod";
import type { Brain } from "./context-service.js";
import {
  ActionEngine,
  reservationInput,
  type ActionContext,
} from "../domain/action-engine.js";
import { OrderEngine, orderInput } from "../domain/order-engine.js";
import type { Db } from "../database/db.js";
import { withTransaction, type Tx } from "../database/db.js";
import { AppError } from "../domain/errors.js";
import { randomUUID } from "node:crypto";
import { zodToJsonSchema } from "zod-to-json-schema";
export const ToolNames = [
  "get_restaurant_info",
  "get_business_hours",
  "get_menu",
  "get_menu_item",
  "get_allergen_info",
  "get_parking_info",
  "get_specials",
  "get_season_status",
  "request_human_transfer",
  "check_reservation_availability",
  "create_reservation",
  "find_reservation",
  "modify_reservation",
  "cancel_reservation",
  "calculate_order",
  "create_order",
  "find_order",
  "modify_order",
  "cancel_order",
] as const;
export type ToolName = (typeof ToolNames)[number];
type ExecutionContext = ActionContext & { confirmationId?: string; transaction?: Tx };
type Tool = {
  name: ToolName;
  description: string;
  schema: z.ZodType;
  run: (
    args: Record<string, unknown>,
    brain: Brain,
    context: ExecutionContext,
  ) => Promise<unknown>;
};
const empty = z.object({}).strict();
const reservationLookup = z
  .object({
    confirmationCode: z.string().min(3).optional(),
    phone: z.string().min(7).optional(),
  })
  .refine(
    (v) => v.confirmationCode || v.phone,
    "confirmationCode or phone is required",
  );
const reservationModify = reservationInput
  .partial()
  .required({ partySize: true, date: true, time: true })
  .extend({
    reservationId: z.string().uuid(),
    confirmationId: z.string().uuid(),
  });
// Domain inputs are strict schemas: routing fields must not reach them.
const without = (args: Record<string, unknown>, ...keys: string[]) =>
  Object.fromEntries(Object.entries(args).filter(([key]) => !keys.includes(key)));
// Callers name dishes ("the margherita"), they never know internal ids, so the
// lookup accepts either and matches names case-insensitively.
const menuItemLookup = z
  .object({
    itemId: z.string().min(1).optional(),
    itemName: z.string().trim().min(1).max(120).optional(),
  })
  .strict()
  .refine((v) => v.itemId || v.itemName, "itemId or itemName is required");
type MenuEntry = { id?: string; name?: string };
const normalizeName = (v: string) =>
  v.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
function menuItemResult(brain: Brain, args: Record<string, unknown>) {
  const menu = brain.menu.filter(
    (item): item is MenuEntry => typeof item === "object" && item !== null,
  );
  let item = args.itemId ? menu.find((x) => x.id === args.itemId) : undefined;
  if (!item && typeof args.itemName === "string") {
    const wanted = normalizeName(args.itemName);
    item =
      menu.find((x) => x.name && normalizeName(x.name) === wanted) ??
      menu.find((x) => x.name && (normalizeName(x.name).includes(wanted) || wanted.includes(normalizeName(x.name))));
  }
  return item ? { state: "KNOWN", item } : { state: "UNKNOWN", item: null };
}
/** Mutations are two-phase: the model proposes, the caller confirms, then code executes. */
export const MutationToolNames = [
  "create_reservation",
  "modify_reservation",
  "cancel_reservation",
  "create_order",
  "modify_order",
  "cancel_order",
] as const satisfies readonly ToolName[];
export type MutationToolName = (typeof MutationToolNames)[number];
export const isMutationTool = (name: string): name is MutationToolName =>
  (MutationToolNames as readonly string[]).includes(name);
export type LlmToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};
/** Converts a zod schema into an Anthropic-compatible top-level object JSON schema. */
function toObjectJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const raw = zodToJsonSchema(schema, { $refStrategy: "none", target: "jsonSchema7" }) as Record<string, unknown>;
  delete raw.$schema;
  const parts = Array.isArray(raw.allOf) ? (raw.allOf as Record<string, unknown>[]) : [raw];
  const properties: Record<string, unknown> = {};
  const required = new Set<string>();
  for (const part of parts) {
    Object.assign(properties, (part.properties as Record<string, unknown>) ?? {});
    for (const key of (part.required as string[]) ?? []) required.add(key);
  }
  // confirmationId is issued by the server after the caller agrees; the model never supplies it.
  delete properties.confirmationId;
  required.delete("confirmationId");
  return { type: "object", properties, required: [...required], additionalProperties: false };
}
const toolDescriptions: Partial<Record<ToolName, string>> = {
  get_restaurant_info: "Restaurant policies, address, directions, and general information",
  get_business_hours: "Weekly opening hours and special closures",
  get_menu: "Full active menu with item ids, prices in cents, availability, dietary info and allergens",
  get_parking_info: "Parking information",
  get_specials: "Current specials",
  get_season_status: "Whether the restaurant is open for the season",
  request_human_transfer: "Transfer the caller to a staff member. Use when the caller asks for a person, has a complaint, or you cannot help.",
  check_reservation_availability: "Check whether a table is available. Requires guest name and phone as well; use the caller's details.",
  create_reservation: "Propose a new reservation. Only call once you have name, phone, party size, date (YYYY-MM-DD) and time (HH:MM, 24h). The caller must then confirm.",
  find_reservation: "Find an existing reservation by confirmation code or phone number",
  modify_reservation: "Propose a change to an existing reservation (use the id returned by find_reservation). The caller must then confirm.",
  cancel_reservation: "Propose cancelling an existing reservation (id from find_reservation). The caller must then confirm.",
  calculate_order: "Price an order draft. menuItemId values must come from get_menu.",
  create_order: "Propose placing an order. Only call after calculate_order succeeded. The caller must then confirm.",
  find_order: "Find an existing order by id and the phone number it was placed with",
  modify_order: "Propose replacing the items of an existing order. The caller must then confirm.",
  cancel_order: "Propose cancelling an existing order. The caller must then confirm.",
};
export class ActionRegistry {
  private tools = new Map<ToolName, Tool>();
  private readonly db: Db;
  private readonly reservations: ActionEngine;
  private readonly orders: OrderEngine;
  constructor(
    db: Db,
    reservations = new ActionEngine(db),
    orders = new OrderEngine(db),
  ) {
    this.db = db;
    this.reservations = reservations;
    this.orders = orders;
    const add = (
      name: ToolName,
      description: string,
      schema: z.ZodType,
      run: Tool["run"],
    ) => this.tools.set(name, { name, description, schema, run });
    add(
      "get_restaurant_info",
      "Restaurant information",
      empty,
      async (_, b) => ({ state: "KNOWN", policies: b.policies }),
    );
    add("get_business_hours", "Business hours", empty, async (_, b) => ({
      state: b.hours ? "KNOWN" : "NOT_CONFIGURED",
      hours: b.hours,
    }));
    add("get_menu", "Menu", empty, async (_, b) => ({
      state: b.menu.length ? "KNOWN" : "NOT_CONFIGURED",
      items: b.menu,
    }));
    add(
      "get_menu_item",
      "Look up one menu item by its id or by its name as the caller said it",
      menuItemLookup,
      async (a, b) => menuItemResult(b, a),
    );
    add(
      "get_allergen_info",
      "Allergen and dietary information for one menu item, by id or name",
      menuItemLookup,
      async (a, b) => menuItemResult(b, a),
    );
    add("get_parking_info", "Parking information", empty, async (_, b) => ({
      state: b.policies.parking ? "KNOWN" : "NOT_CONFIGURED",
      parking: b.policies.parking,
    }));
    add("get_specials", "Specials", empty, async (_, b) => ({
      state: b.policies.specials ? "KNOWN" : "NOT_CONFIGURED",
      specials: b.policies.specials,
    }));
    add("get_season_status", "Season status", empty, async (_, b) => ({
      state: "KNOWN",
      status: b.seasonalStatus,
      closedMessage: b.seasonalClosedMessage,
    }));
    add(
      "request_human_transfer",
      "Request human transfer",
      z.object({ reason: z.string().max(200).optional() }).strict(),
      async (a, b) => ({
        state: b.humanTransfer?.enabled ? "KNOWN" : "NOT_CONFIGURED",
        requested: true,
        transferAvailable: Boolean(b.humanTransfer?.enabled && b.humanTransfer.destination),
        reason: a.reason ?? null,
      }),
    );
    add(
      "check_reservation_availability",
      "Check reservation availability",
      reservationInput,
      async (a, _, c) =>
        this.reservations.availability.check(
          c.restaurantId,
          a as { date: string; time: string; partySize: number },
        ),
    );
    add(
      "create_reservation",
      "Create reservation",
      reservationInput.extend({ confirmationId: z.string().uuid() }),
      async (a, _, c) =>
        this.reservations.createReservation(c, without(a, "confirmationId"), c.confirmationId!, c.transaction),
    );
    add(
      "find_reservation",
      "Find reservation",
      reservationLookup,
      async (a, _, c) => this.reservations.findReservation(c.restaurantId, a),
    );
    add(
      "modify_reservation",
      "Modify reservation",
      reservationModify,
      async (a, _, c) =>
        this.reservations.modifyReservation(
          c,
          String(a.reservationId),
          without(a, "reservationId", "confirmationId"),
          c.confirmationId!,
          c.transaction,
        ),
    );
    add(
      "cancel_reservation",
      "Cancel reservation",
      z
        .object({
          reservationId: z.string().uuid(),
          confirmationId: z.string().uuid(),
        })
        .strict(),
      async (a, _, c) =>
        this.reservations.cancelReservation(
          c,
          a.reservationId as string,
          a.confirmationId as string,
          c.transaction,
        ),
    );
    add("calculate_order", "Calculate order", orderInput, async (a, _, c) =>
      this.orders.calculate(c.restaurantId, a),
    );
    add(
      "create_order",
      "Create order",
      orderInput.extend({ confirmationId: z.string().uuid() }),
      async (a, _, c) =>
        this.orders.create(c.restaurantId, without(a, "confirmationId"), c.confirmationId, c.transaction),
    );
    add(
      "find_order",
      "Find order",
      z
        .object({ orderId: z.string().uuid(), phone: z.string().min(7) })
        .strict(),
      async (a, _, c) =>
        this.orders.find(
          c.restaurantId,
          a.orderId as string,
          a.phone as string,
        ),
    );
    add(
      "modify_order",
      "Modify order",
      orderInput.extend({ orderId: z.string().uuid(), confirmationId: z.string().uuid() }),
      async (a, _, c) =>
        this.orders.modify(
          c.restaurantId,
          a.orderId as string,
          without(a, "orderId", "confirmationId"),
          c.confirmationId,
          c.transaction,
        ),
    );
    add(
      "cancel_order",
      "Cancel order",
      z
        .object({
          orderId: z.string().uuid(),
          confirmationId: z.string().uuid(),
        })
        .strict(),
      async (a, _, c) =>
        this.orders.cancel(
          c.restaurantId,
          a.orderId as string,
          c.confirmationId as string,
          c.transaction,
        ),
    );
  }
  definitions() {
    return [...this.tools.values()].map(({ name, description, schema }) => ({
      name,
      description,
      inputSchema: schema,
    }));
  }
  /** JSON-schema tool definitions for an LLM; mutation tools omit the server-issued confirmationId. */
  llmDefinitions(): LlmToolDefinition[] {
    return [...this.tools.values()].map(({ name, description, schema }) => ({
      name,
      description: toolDescriptions[name] ?? description,
      inputSchema: toObjectJsonSchema(schema),
    }));
  }
  /** Validates model-proposed mutation arguments (without confirmationId) before a confirmation is issued. */
  validateProposal(name: MutationToolName, args: unknown) {
    const tool = this.tools.get(name)!;
    const placeholder = "00000000-0000-4000-8000-000000000000";
    const parsed = tool.schema.safeParse({ ...(args as Record<string, unknown>), confirmationId: placeholder });
    if (!parsed.success)
      throw new AppError("INVALID_ACTION_INPUT", "Invalid action input", 400, { issues: parsed.error.issues });
    const { confirmationId: _ignored, ...data } = parsed.data as Record<string, unknown>;
    void _ignored;
    return data;
  }
  private async executeAtomicCreate(name: ToolName, parsed: Record<string, unknown>, brain: Brain, context: ExecutionContext) {
    const claimId = randomUUID();
    try { return await withTransaction(this.db, async (tx) => {
      const claimed = (await tx.query<{ response: unknown; status: "PROCESSING" | "COMPLETED"; action: string }>(
        "INSERT INTO action_idempotency(restaurant_id,action,idempotency_key,response,status,claim_id,lease_until) VALUES($1,$2,$3,NULL,'PROCESSING',$4,NOW()+INTERVAL '2 minutes') ON CONFLICT (restaurant_id,action,idempotency_key) DO UPDATE SET status='PROCESSING',response=NULL,claim_id=EXCLUDED.claim_id,lease_until=EXCLUDED.lease_until,updated_at=NOW() WHERE action_idempotency.status='PROCESSING' AND action_idempotency.lease_until<NOW() RETURNING response,status,action",
        [context.restaurantId, name, context.idempotencyKey, claimId],
      )).rows[0];
      if (!claimed) {
        const existing = (await tx.query<{ response: unknown; status: "PROCESSING" | "COMPLETED"; action: string }>("SELECT response,status,action FROM action_idempotency WHERE restaurant_id=$1 AND action=$2 AND idempotency_key=$3", [context.restaurantId, name, context.idempotencyKey])).rows[0];
        if (existing?.status === "PROCESSING") throw new AppError("ACTION_IN_PROGRESS", "The same action is already being processed", 409);
        if (existing) return existing.response;
      }
      const txContext = { ...context, transaction: tx };
      const result = await this.runTool(name, parsed, brain, txContext);
      await tx.query("UPDATE action_idempotency SET response=$4,status='COMPLETED',lease_until=NULL,updated_at=NOW() WHERE restaurant_id=$1 AND action=$2 AND idempotency_key=$3 AND status='PROCESSING' AND claim_id=$5", [context.restaurantId, name, context.idempotencyKey, JSON.stringify(result), claimId]);
      return result;
    }); } catch (error) {
      await this.db.query("DELETE FROM action_idempotency WHERE restaurant_id=$1 AND action=$2 AND idempotency_key=$3 AND status='PROCESSING' AND claim_id=$4", [context.restaurantId, name, context.idempotencyKey, claimId]);
      throw error;
    }
  }
  private async runTool(name: ToolName, args: Record<string, unknown>, brain: Brain, context: ExecutionContext & { transaction?: Tx }) {
    const tool = this.tools.get(name)!;
    return tool.run(args, brain, context);
  }
  async execute(
    name: string,
    args: unknown,
    brain: Brain,
    context: ExecutionContext,
  ) {
    const tool = this.tools.get(name as ToolName);
    if (!tool) throw new AppError("UNKNOWN_ACTION", "Unknown action", 400);
    const parsed = tool.schema.safeParse(args);
    if (!parsed.success)
      throw new AppError("INVALID_ACTION_INPUT", "Invalid action input", 400, {
        issues: parsed.error.issues,
      });
    if (!context.restaurantId || !context.actorType || !context.idempotencyKey)
      throw new AppError(
        "ACTION_CONTEXT_REQUIRED",
        "Tenant action context is required",
        401,
      );
    const mutation = name.startsWith("create_") || name.startsWith("modify_") || name.startsWith("cancel_");
    if (mutation)
      return this.executeAtomicCreate(name as ToolName, parsed.data as Record<string, unknown>, brain, context);
    const claimId = mutation ? randomUUID() : undefined;
    if (mutation) {
      const claimed = (await this.db.query<{ response: unknown; status: "PROCESSING" | "COMPLETED"; action: string }>(
        "INSERT INTO action_idempotency(restaurant_id,action,idempotency_key,response,status,claim_id,lease_until) VALUES($1,$2,$3,NULL,'PROCESSING',$4,NOW()+INTERVAL '2 minutes') ON CONFLICT (restaurant_id,action,idempotency_key) DO UPDATE SET status='PROCESSING',response=NULL,claim_id=EXCLUDED.claim_id,lease_until=EXCLUDED.lease_until,updated_at=NOW() WHERE action_idempotency.status='PROCESSING' AND action_idempotency.lease_until<NOW() RETURNING response,status,action",
        [context.restaurantId, name, context.idempotencyKey, claimId],
      )).rows[0];
      if (!claimed) {
        const existing = (await this.db.query<{ response: unknown; status: "PROCESSING" | "COMPLETED"; action: string }>(
          "SELECT response,status,action FROM action_idempotency WHERE restaurant_id=$1 AND action=$2 AND idempotency_key=$3",
          [context.restaurantId, name, context.idempotencyKey],
        )).rows[0];
        if (existing && existing.action !== name)
          throw new AppError("IDEMPOTENCY_KEY_REUSED", "Idempotency key was used for another action", 409);
        if (existing?.status === "PROCESSING")
          throw new AppError("ACTION_IN_PROGRESS", "The same action is already being processed", 409);
        if (existing) return existing.response;
      }
    }
    try {
      const result = await tool.run(parsed.data as Record<string, unknown>, brain, context);
      if (mutation)
        await this.db.query("UPDATE action_idempotency SET response=$4,status='COMPLETED',lease_until=NULL,updated_at=NOW() WHERE restaurant_id=$1 AND action=$2 AND idempotency_key=$3 AND status='PROCESSING' AND claim_id=$5", [context.restaurantId, name, context.idempotencyKey, JSON.stringify(result), claimId]);
      return result;
    } catch (error) {
      if (mutation)
        await this.db.query("DELETE FROM action_idempotency WHERE restaurant_id=$1 AND action=$2 AND idempotency_key=$3 AND status='PROCESSING' AND claim_id=$4", [context.restaurantId, name, context.idempotencyKey, claimId]);
      if (error instanceof AppError) throw error;
      throw new AppError("ACTION_FAILED", "The requested action could not be completed", 409);
    }
  }
}
