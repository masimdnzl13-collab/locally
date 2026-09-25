import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Db } from "../database/db.js";
import { AppError } from "../domain/errors.js";

const id = z.string().uuid();
const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:mm");
const interval = (start: string, end: string) => start < end;
export const brainSchemas = {
  profile: z.object({
    name: z.string().trim().min(1).max(120),
    legalName: z.string().max(160).optional(),
    description: z.string().max(2000).optional(),
    phoneNumber: z.string().max(40).optional(),
    email: z.string().email().optional(),
    website: z.string().url().optional(),
    address: z.string().max(240).optional(),
    city: z.string().max(100).optional(),
    state: z.string().max(100).optional(),
    postalCode: z.string().max(20).optional(),
    country: z.string().max(80).optional(),
    timezone: z.string().min(1).max(80),
    defaultLanguage: z.enum(["EN", "ES"]),
    supportedLanguages: z.array(z.enum(["EN", "ES"])).min(1),
  }),
  hours: z
    .object({
      weekday: z.number().int().min(0).max(6),
      startTime: time,
      endTime: time,
    })
    .refine(
      (x) => interval(x.startTime, x.endTime),
      "startTime must be before endTime",
    ),
  closures: z
    .object({
      closureDate: z.string().date(),
      startTime: time.optional(),
      endTime: time.optional(),
      reason: z.string().trim().min(1).max(300),
      active: z.boolean().default(true),
    })
    .refine(
      (x) => Boolean(x.startTime) === Boolean(x.endTime),
      "Closure start and end must be supplied together",
    )
    .refine(
      (x) => !x.startTime || interval(x.startTime!, x.endTime!),
      "Closure startTime must be before endTime",
    ),
  category: z.object({
    name: z.string().trim().min(1).max(120),
    description: z.string().max(1000).optional(),
    displayOrder: z.number().int().default(0),
    active: z.boolean().default(true),
  }),
  item: z.object({
    categoryId: id,
    name: z.string().trim().min(1).max(160),
    description: z.string().max(2000).optional(),
    priceCents: z.number().int().nonnegative(),
    active: z.boolean().default(true),
    available: z.boolean().default(true),
    unavailableReason: z.string().max(300).optional(),
    dietaryInformation: z.array(z.string().trim().min(1)).default([]),
    allergens: z
      .array(
        z.object({
          name: z.string().trim().min(1),
          status: z.enum(["CONTAINS", "MAY_CONTAIN", "UNKNOWN"]),
        }),
      )
      .default([]),
    displayOrder: z.number().int().default(0),
  }),
  faq: z.object({
    question: z.string().trim().min(1).max(500),
    answer: z.string().trim().min(1).max(4000),
    category: z.string().max(100).optional(),
    active: z.boolean().default(true),
    priority: z.number().int().default(0),
    displayOrder: z.number().int().default(0),
  }),
  settings: z.object({
    parking: z.record(z.unknown()).default({}), directions: z.record(z.unknown()).default({}),
    reservationRules: z.object({
      enabled: z.boolean().optional(), minimumPartySize: z.number().int().positive().optional(),
      maximumPartySize: z.number().int().positive().optional(), minimumNoticeMinutes: z.number().int().nonnegative().optional(),
    }).passthrough().default({}), escalation: z.record(z.unknown()).default({}), aiConfiguration: z.record(z.unknown()).default({}),
  }).superRefine((x, ctx) => { const r=x.reservationRules; if (r.minimumPartySize !== undefined && r.maximumPartySize !== undefined && r.maximumPartySize < r.minimumPartySize) ctx.addIssue({code:z.ZodIssueCode.custom,path:['reservationRules','maximumPartySize'],message:'maximumPartySize must be at least minimumPartySize'}); }),
};
type Resource = "hours" | "closures" | "categories" | "items" | "faqs";
const tables: Record<Resource, string> = {
  hours: "business_hours",
  closures: "special_closures",
  categories: "menu_categories",
  items: "menu_items",
  faqs: "faqs",
};
const schemaFor = (resource: Resource) =>
  resource === "categories"
    ? brainSchemas.category
    : resource === "items"
      ? brainSchemas.item
      : resource === "faqs"
        ? brainSchemas.faq
        : brainSchemas[resource];

export class RestaurantBrainService {
  constructor(private readonly db: Db) {}
  private async restaurantExists(restaurantId: string) {
    const row = (
      await this.db.query("SELECT id FROM restaurants WHERE id=$1", [
        restaurantId,
      ])
    ).rows[0];
    if (!row) throw new AppError("NOT_FOUND", "Restaurant not found", 404);
  }
  private async owned(restaurantId: string, recordId: string, table: string) {
    const row = (
      await this.db.query(
        `SELECT id FROM ${table} WHERE id=$1 AND restaurant_id=$2`,
        [recordId, restaurantId],
      )
    ).rows[0];
    if (!row) throw new AppError("NOT_FOUND", "Brain record not found", 404);
  }
  async profile(restaurantId: string) {
    return (
      (
        await this.db.query("SELECT * FROM restaurants WHERE id=$1", [
          restaurantId,
        ])
      ).rows[0] ?? null
    );
  }
  async updateProfile(restaurantId: string, input: unknown) {
    await this.restaurantExists(restaurantId);
    const d = brainSchemas.profile.parse(input);
    const row = (
      await this.db.query(
        "UPDATE restaurants SET name=$2,legal_name=$3,description=$4,phone_number=$5,email=$6,website=$7,address=$8,city=$9,state=$10,postal_code=$11,country=$12,timezone=$13,default_language=$14,supported_languages=$15,updated_at=NOW() WHERE id=$1 RETURNING *",
        [
          restaurantId,
          d.name,
          d.legalName ?? null,
          d.description ?? null,
          d.phoneNumber ?? null,
          d.email ?? null,
          d.website ?? null,
          d.address ?? null,
          d.city ?? null,
          d.state ?? null,
          d.postalCode ?? null,
          d.country ?? null,
          d.timezone,
          d.defaultLanguage,
          JSON.stringify(d.supportedLanguages),
        ],
      )
    ).rows[0];
    if (!row) throw new AppError("NOT_FOUND", "Restaurant not found", 404);
    return row;
  }
  // Onboarding gate (Locally /kayit/us/menu): the AI can only answer callers once
  // opening hours and a basic menu exist. Counts only; the threshold lives in Locally.
  async readiness(restaurantId: string) {
    await this.restaurantExists(restaurantId);
    const row = (
      await this.db.query<{ hours_days: string; menu_items: string }>(
        `SELECT
           (SELECT COUNT(DISTINCT weekday) FROM business_hours WHERE restaurant_id=$1) AS hours_days,
           (SELECT COUNT(*) FROM menu_items WHERE restaurant_id=$1 AND active) AS menu_items`,
        [restaurantId],
      )
    ).rows[0];
    return { hoursDays: Number(row?.hours_days ?? 0), menuItems: Number(row?.menu_items ?? 0) };
  }
  async list(restaurantId: string, resource: Resource) {
    await this.restaurantExists(restaurantId);
    return (
      await this.db.query(
        `SELECT * FROM ${tables[resource]} WHERE restaurant_id=$1 ORDER BY ${resource === "hours" ? "weekday, start_time" : resource === "closures" ? "closure_date, start_time" : "display_order, id"}`,
        [restaurantId],
      )
    ).rows;
  }
  async create(restaurantId: string, resource: Resource, input: unknown) {
    await this.restaurantExists(restaurantId);
    const d = schemaFor(resource).parse(input) as Record<string, unknown>;
    if (
      resource === "items" &&
      !(
        await this.db.query(
          "SELECT id FROM menu_categories WHERE id=$1 AND restaurant_id=$2 AND active=true",
          [d.categoryId, restaurantId],
        )
      ).rows[0]
    )
      throw new AppError(
        "INVALID_CATEGORY",
        "Menu category does not belong to this restaurant",
        400,
      );
    const maps: Record<Resource, Record<string, unknown>> = {
      hours: {
        weekday: d.weekday,
        start_time: d.startTime,
        end_time: d.endTime,
      },
      closures: {
        closure_date: d.closureDate,
        start_time: d.startTime ?? null,
        end_time: d.endTime ?? null,
        reason: d.reason,
        active: d.active,
      },
      categories: {
        name: d.name,
        description: d.description ?? null,
        display_order: d.displayOrder,
        active: d.active,
      },
      items: {
        category_id: d.categoryId,
        name: d.name,
        description: d.description ?? null,
        price_cents: d.priceCents,
        active: d.active,
        available: d.available,
        unavailable_reason: d.unavailableReason ?? null,
        dietary_information: JSON.stringify(d.dietaryInformation),
        allergens: JSON.stringify(d.allergens),
        display_order: d.displayOrder,
      },
      faqs: {
        question: d.question,
        answer: d.answer,
        category: d.category ?? null,
        active: d.active,
        priority: d.priority,
        display_order: d.displayOrder,
      },
    };
    const map = maps[resource],
      keys = ["id", "restaurant_id", ...Object.keys(map)];
    try {
      return (
        await this.db.query(
          `INSERT INTO ${tables[resource]} (${keys.join(",")}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(",")}) RETURNING *`,
          [randomUUID(), restaurantId, ...Object.values(map)],
        )
      ).rows[0];
    } catch (error) {
      if (
        String(error).includes("duplicate") ||
        String(error).includes("unique")
      )
        throw new AppError(
          "DUPLICATE_BRAIN_RECORD",
          "Duplicate restaurant Brain record",
          409,
        );
      throw error;
    }
  }
  async update(
    restaurantId: string,
    resource: Resource,
    recordId: string,
    input: unknown,
  ) {
    await this.owned(restaurantId, recordId, tables[resource]);
    const d = schemaFor(resource).parse(input) as Record<string, unknown>;
    if (resource === "items" && !(await this.db.query("SELECT id FROM menu_categories WHERE id=$1 AND restaurant_id=$2", [d.categoryId, restaurantId])).rows[0])
      throw new AppError("INVALID_CATEGORY", "Menu category does not belong to this restaurant", 400);
    const map =
      resource === "hours"
        ? { weekday: d.weekday, start_time: d.startTime, end_time: d.endTime }
        : resource === "closures"
          ? {
              closure_date: d.closureDate,
              start_time: d.startTime ?? null,
              end_time: d.endTime ?? null,
              reason: d.reason,
              active: d.active,
            }
          : resource === "categories"
            ? {
                name: d.name,
                description: d.description ?? null,
                display_order: d.displayOrder,
                active: d.active,
              }
            : resource === "items"
              ? {
                  category_id: d.categoryId,
                  name: d.name,
                  description: d.description ?? null,
                  price_cents: d.priceCents,
                  active: d.active,
                  available: d.available,
                  unavailable_reason: d.unavailableReason ?? null,
                  dietary_information: JSON.stringify(d.dietaryInformation),
                  allergens: JSON.stringify(d.allergens),
                  display_order: d.displayOrder,
                }
              : {
                  question: d.question,
                  answer: d.answer,
                  category: d.category ?? null,
                  active: d.active,
                  priority: d.priority,
                  display_order: d.displayOrder,
                };
    const keys = Object.keys(map);
    try {
      return (
        await this.db.query(
          `UPDATE ${tables[resource]} SET ${keys.map((key, i) => `${key}=$${i + 3}`).join(",")},updated_at=NOW() WHERE id=$1 AND restaurant_id=$2 RETURNING *`,
          [recordId, restaurantId, ...Object.values(map)],
        )
      ).rows[0];
    } catch (error) {
      if (
        String(error).includes("duplicate") ||
        String(error).includes("unique")
      )
        throw new AppError(
          "DUPLICATE_BRAIN_RECORD",
          "Duplicate restaurant Brain record",
          409,
        );
      throw error;
    }
  }
  async remove(restaurantId: string, resource: Resource, recordId: string) {
    await this.owned(restaurantId, recordId, tables[resource]);
    await this.db.query(
      `DELETE FROM ${tables[resource]} WHERE id=$1 AND restaurant_id=$2`,
      [recordId, restaurantId],
    );
    return { deleted: true };
  }
  async settings(restaurantId: string, input: unknown) {
    await this.restaurantExists(restaurantId);
    const d = brainSchemas.settings.parse(input);
    return (
      await this.db.query(
        "INSERT INTO restaurant_settings(restaurant_id,parking,directions,reservation_rules,escalation,ai_configuration) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(restaurant_id) DO UPDATE SET parking=EXCLUDED.parking,directions=EXCLUDED.directions,reservation_rules=EXCLUDED.reservation_rules,escalation=EXCLUDED.escalation,ai_configuration=EXCLUDED.ai_configuration RETURNING *",
        [
          restaurantId,
          JSON.stringify(d.parking),
          JSON.stringify(d.directions),
          JSON.stringify(d.reservationRules),
          JSON.stringify(d.escalation),
          JSON.stringify(d.aiConfiguration),
        ],
      )
    ).rows[0];
  }
}
