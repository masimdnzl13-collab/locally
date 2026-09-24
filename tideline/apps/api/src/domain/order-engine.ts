import { randomUUID } from "node:crypto";
import { z } from "zod";
import { withTransaction, type Db, type Tx } from "../database/db.js";
import { AppError } from "./errors.js";
export const orderInput = z
  .object({
    customerName: z.string().trim().min(1).max(120),
    customerPhone: z.string().min(7).max(40),
    orderType: z.enum(["PICKUP", "DINE_IN", "OTHER"]),
    specialInstructions: z.string().max(1000).optional(),
    items: z
      .array(
        z.object({
          menuItemId: z.string().uuid(),
          quantity: z.number().int().positive().max(99),
          specialInstructions: z.string().max(500).optional(),
          modifiers: z
            .array(
              z.object({
                groupId: z.string().uuid(),
                optionId: z.string().uuid(),
              }),
            )
            .default([]),
        }),
      )
      .min(1),
  })
  .strict();
type MenuItem = {
  id: string;
  name: string;
  priceCents: number;
  available?: boolean;
  modifiers?: Array<{
    groupId: string;
    name: string;
    options: Array<{
      id: string;
      name: string;
      priceCents: number;
      active?: boolean;
    }>;
  }>;
};
const phone = (v: string) => v.replace(/[^\d+]/g, "");
export class OrderEngine {
  constructor(private db: Db) {}
  private async menu(r: string) {
    const items = (
      await this.db.query<{
        id: string;
        name: string;
        price_cents: number;
        available: boolean;
      }>(
        "SELECT id,name,price_cents,available FROM menu_items WHERE restaurant_id=$1 AND active=true AND available=true ORDER BY display_order,id",
        [r],
      )
    ).rows;
    const menu: MenuItem[] = [];
    for (const item of items) {
      const groups = (
        await this.db.query<{ id: string; name: string }>(
          "SELECT id,name FROM modifier_groups WHERE restaurant_id=$1 AND menu_item_id=$2",
          [r, item.id],
        )
      ).rows;
      const modifiers = [];
      for (const group of groups) {
        const options = (
          await this.db.query<{
            id: string;
            name: string;
            price_delta_cents: number;
            active: boolean;
          }>(
            "SELECT id,name,price_delta_cents,active FROM modifier_options WHERE restaurant_id=$1 AND modifier_group_id=$2 AND active=true",
            [r, group.id],
          )
        ).rows;
        modifiers.push({
          groupId: group.id,
          name: group.name,
          options: options.map((option) => ({
            id: option.id,
            name: option.name,
            priceCents: option.price_delta_cents,
            active: option.active,
          })),
        });
      }
      menu.push({
        id: item.id,
        name: item.name,
        priceCents: item.price_cents,
        available: item.available,
        modifiers,
      });
    }
    return menu;
  }
  async calculate(r: string, input: unknown) {
    const d = orderInput.parse(input),
      menu = await this.menu(r),
      lines: Array<{
        item: MenuItem;
        x: (typeof d.items)[number];
        unit: number;
        snapshots: Array<{
          groupName: string;
          optionName: string;
          priceCents: number;
        }>;
        lineTotal: number;
      }> = [];
    for (const x of d.items) {
      const item = menu.find((m) => m.id === x.menuItemId);
      if (!item || item.available === false)
        throw new AppError(
          "MENU_ITEM_UNAVAILABLE",
          "Menu item is unavailable",
          409,
        );
      let modifiers = 0;
      const snapshots: Array<{
        groupName: string;
        optionName: string;
        priceCents: number;
      }> = [];
      for (const m of x.modifiers) {
        const group = item.modifiers?.find((g) => g.groupId === m.groupId),
          option = group?.options.find(
            (o) => o.id === m.optionId && o.active !== false,
          );
        if (!group || !option)
          throw new AppError(
            "INVALID_MODIFIER",
            "Modifier is not valid for this item",
            400,
          );
        modifiers += option.priceCents;
        snapshots.push({
          groupName: group.name,
          optionName: option.name,
          priceCents: option.priceCents,
        });
      }
      const unit = item.priceCents + modifiers;
      lines.push({ item, x, unit, snapshots, lineTotal: unit * x.quantity });
    }
    const subtotalCents = lines.reduce((n, l) => n + l.lineTotal, 0),
      settings = (
        await this.db.query<{
          tax_basis_points: number;
          currency: string;
          accept_orders: boolean;
          allowed_order_types: string[];
        }>(
          "SELECT tax_basis_points,currency,accept_orders,allowed_order_types FROM order_settings WHERE restaurant_id=$1",
          [r],
        )
      ).rows[0],
      taxCents = Math.floor(
        (subtotalCents * (settings?.tax_basis_points ?? 0)) / 10000,
      );
    if (!settings || settings.accept_orders !== true)
      throw new AppError(
        "ORDERS_DISABLED",
        "Orders are not currently accepted",
        409,
      );
    if (
      Array.isArray(settings?.allowed_order_types) &&
      !settings.allowed_order_types.includes(d.orderType)
    )
      throw new AppError(
        "ORDER_TYPE_UNAVAILABLE",
        "This order type is unavailable",
        409,
      );
    return {
      input: d,
      lines,
      subtotalCents,
      taxCents,
      totalCents: subtotalCents + taxCents,
      currency: settings?.currency ?? "USD",
    };
  }
  async create(r: string, input: unknown, confirmationId?: string, existingTx?: Tx) {
    if (!confirmationId)
      throw new AppError(
        "CONFIRMATION_REQUIRED",
        "Explicit order confirmation is required",
        409,
      );
    const c = await this.calculate(r, input),
      d = c.input,
      id = randomUUID(),
      number = `${Date.now().toString(36).toUpperCase()}-${id.slice(0, 4).toUpperCase()}`;
    const run = async (tx: Tx) => {
      await this.consumeConfirmation(tx, r, confirmationId, "CREATE_ORDER");
      const row = (
        await tx.query(
          "INSERT INTO orders(id,restaurant_id,order_number,status,customer_name,customer_phone,order_type,special_instructions,subtotal_cents,tax_cents,total_cents,currency,source) VALUES($1,$2,$3,'CONFIRMED',$4,$5,$6,$7,$8,$9,$10,$11,'AI_PHONE') RETURNING id,order_number,status,subtotal_cents,tax_cents,total_cents,currency",
          [
            id,
            r,
            number,
            d.customerName,
            phone(d.customerPhone),
            d.orderType,
            d.specialInstructions ?? null,
            c.subtotalCents,
            c.taxCents,
            c.totalCents,
            c.currency,
          ],
        )
      ).rows[0];
      if (!row)
        throw new AppError("ORDER_CREATE_FAILED", "Order was not created", 500);
      for (const l of c.lines) {
        const itemId = randomUUID();
        await tx.query(
          "INSERT INTO order_items(id,order_id,menu_item_id,item_name_snapshot,quantity,unit_price_cents,line_total_cents,special_instructions) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
          [
            itemId,
            id,
            l.item.id,
            l.item.name,
            l.x.quantity,
            l.unit,
            l.lineTotal,
            l.x.specialInstructions ?? null,
          ],
        );
        for (const s of l.snapshots)
          await tx.query(
            "INSERT INTO order_item_modifiers(id,order_item_id,modifier_group_name_snapshot,modifier_option_name_snapshot,price_adjustment_cents) VALUES($1,$2,$3,$4,$5)",
            [randomUUID(), itemId, s.groupName, s.optionName, s.priceCents],
          );
      }
      await tx.query(
        "INSERT INTO order_events(id,order_id,restaurant_id,event_type,actor_type) VALUES($1,$2,$3,'CREATED','AI')",
        [randomUUID(), id, r],
      );
      await tx.query(
        "INSERT INTO outbox_events(id,restaurant_id,event_type,aggregate_type,aggregate_id,payload) SELECT $1,$2,'ORDER_CREATED','ORDER',$3,jsonb_build_object('phone',customer_phone,'orderNumber',order_number) FROM orders WHERE id=$3 AND restaurant_id=$2 ON CONFLICT DO NOTHING",
        [randomUUID(), r, id],
      );
      return { success: true, order: row };
    };
    return existingTx ? run(existingTx) : withTransaction(this.db, run);
  }
  async find(r: string, id: string, customerPhone: string) {
    const row = (
      await this.db.query(
        "SELECT * FROM orders WHERE id=$1 AND restaurant_id=$2 AND customer_phone=$3",
        [id, r, phone(customerPhone)],
      )
    ).rows[0];
    if (!row) throw new AppError("ORDER_NOT_FOUND", "Order not found", 404);
    return { found: true, order: row };
  }
  async modify(r: string, id: string, input: unknown, confirmationId?: string, existingTx?: Tx) {
    if (!confirmationId)
      throw new AppError(
        "CONFIRMATION_REQUIRED",
        "Explicit order confirmation is required",
        409,
      );
    const current = (
      await this.db.query(
        "SELECT customer_phone FROM orders WHERE id=$1 AND restaurant_id=$2 AND status='CONFIRMED'",
        [id, r],
      )
    ).rows[0];
    if (!current) throw new AppError("ORDER_NOT_FOUND", "Order not found", 404);
    const c = await this.calculate(r, input);
    const run = async (tx: Tx) => {
      await this.consumeConfirmation(tx, r, confirmationId, "MODIFY_ORDER");
      await tx.query(
        "UPDATE orders SET subtotal_cents=$3,tax_cents=$4,total_cents=$5,updated_at=NOW() WHERE id=$1 AND restaurant_id=$2",
        [id, r, c.subtotalCents, c.taxCents, c.totalCents],
      );
      await tx.query("DELETE FROM order_items WHERE order_id=$1", [id]);
      for (const l of c.lines) {
        const itemId = randomUUID();
        await tx.query(
          "INSERT INTO order_items(id,order_id,menu_item_id,item_name_snapshot,quantity,unit_price_cents,line_total_cents,special_instructions) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
          [
            itemId,
            id,
            l.item.id,
            l.item.name,
            l.x.quantity,
            l.unit,
            l.lineTotal,
            l.x.specialInstructions ?? null,
          ],
        );
      }
      await tx.query(
        "INSERT INTO order_events(id,order_id,restaurant_id,event_type,actor_type) VALUES($1,$2,$3,'MODIFIED','AI')",
        [randomUUID(), id, r],
      );
      await tx.query(
        "INSERT INTO outbox_events(id,restaurant_id,event_type,aggregate_type,aggregate_id,payload) SELECT $1,$2,'ORDER_MODIFIED','ORDER',$3,jsonb_build_object('phone',customer_phone,'orderNumber',order_number) FROM orders WHERE id=$3 AND restaurant_id=$2 ON CONFLICT DO NOTHING",
        [randomUUID(), r, id],
      );
      return {
        success: true,
        orderId: id,
        subtotalCents: c.subtotalCents,
        taxCents: c.taxCents,
        totalCents: c.totalCents,
      };
    };
    return existingTx ? run(existingTx) : withTransaction(this.db, run);
  }
  async cancel(r: string, id: string, confirmationId?: string, existingTx?: Tx) {
    if (!confirmationId)
      throw new AppError(
        "CONFIRMATION_REQUIRED",
        "Explicit order confirmation is required",
        409,
      );
    const run = async (tx: Tx) => {
      await this.consumeConfirmation(tx, r, confirmationId, "CANCEL_ORDER");
      const row = (
        await tx.query(
          "UPDATE orders SET status='CANCELLED',cancelled_at=NOW(),updated_at=NOW() WHERE id=$1 AND restaurant_id=$2 AND status IN ('DRAFT','CONFIRMED') RETURNING id,order_number",
          [id, r],
        )
      ).rows[0];
      if (!row) throw new AppError("ORDER_NOT_FOUND", "Order not found", 404);
      await tx.query(
        "INSERT INTO order_events(id,order_id,restaurant_id,event_type,actor_type) VALUES($1,$2,$3,'CANCELLED','AI')",
        [randomUUID(), id, r],
      );
      await tx.query(
        "INSERT INTO outbox_events(id,restaurant_id,event_type,aggregate_type,aggregate_id,payload) SELECT $1,$2,'ORDER_CANCELLED','ORDER',$3,jsonb_build_object('phone',customer_phone,'orderNumber',order_number) FROM orders WHERE id=$3 AND restaurant_id=$2 ON CONFLICT DO NOTHING",
        [randomUUID(), r, id],
      );
      return { success: true, order: row };
    };
    return existingTx ? run(existingTx) : withTransaction(this.db, run);
  }
  private async consumeConfirmation(tx: import("pg").PoolClient, restaurantId: string, confirmationId: string, action: string) {
    const row = (await tx.query(
      "UPDATE action_confirmations SET status='CONSUMED',consumed_at=NOW() WHERE id=$1 AND restaurant_id=$2 AND action=$3 AND status='CONFIRMED' AND expires_at>NOW() RETURNING id",
      [confirmationId, restaurantId, action],
    )).rows[0];
    if (!row) throw new AppError("CONFIRMATION_REQUIRED", "Explicit confirmation is required", 409);
  }
}
