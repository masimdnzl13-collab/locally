import { createHash, randomUUID } from "node:crypto";
import { DateTime } from "luxon";
import { z } from "zod";
import { withTransaction, type Db, type Tx } from "../database/db.js";
import { AppError } from "./errors.js";
export const reservationInput = z
  .object({
    guestName: z.string().trim().min(1).max(120),
    guestPhone: z.string().min(7).max(40),
    guestEmail: z.string().email().optional(),
    partySize: z.number().int().positive(),
    date: z.string().date(),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    specialRequest: z.string().max(1000).optional(),
  })
  .strict();
export type SensitiveAction =
  | "CREATE_RESERVATION"
  | "MODIFY_RESERVATION"
  | "CANCEL_RESERVATION"
  | "CREATE_ORDER"
  | "MODIFY_ORDER"
  | "CANCEL_ORDER";
export type ActionContext = {
  restaurantId: string;
  actorType: "AI" | "STAFF" | "SYSTEM";
  conversationId?: string;
  idempotencyKey: string;
};
const normalizePhone = (v: string) => v.replace(/[^\d+]/g, "");
const digest = (v: unknown) =>
  createHash("sha256").update(JSON.stringify(v)).digest("hex");
type ReservationSettingsRow = {
  timezone: string;
  status: string;
  accept_reservations: boolean;
  advance_booking_days: number;
  same_day_booking_allowed: boolean;
  minimum_notice_minutes: number;
  minimum_party_size: number;
  maximum_party_size: number;
  capacity_per_slot: number;
};
export class ReservationConfirmationService {
  constructor(private db: Db) {}
  async prepare(
    r: string,
    c: string | undefined,
    a: SensitiveAction,
    p: unknown,
  ) {
    const id = randomUUID();
    await this.db.query(
      "INSERT INTO action_confirmations(id,restaurant_id,conversation_id,action,payload_hash,expires_at) VALUES($1,$2,$3,$4,$5,NOW()+INTERVAL '10 minutes')",
      [id, r, c ?? null, a, digest(p)],
    );
    return { id, state: "READY_FOR_CONFIRMATION" as const };
  }
  async confirm(r: string, id: string, p: unknown) {
    const row = (
      await this.db.query<{ payload_hash: string }>(
        "UPDATE action_confirmations SET status='CONFIRMED',confirmed_at=NOW() WHERE id=$1 AND restaurant_id=$2 AND status='READY' AND expires_at>NOW() RETURNING payload_hash",
        [id, r],
      )
    ).rows[0];
    if (!row || row.payload_hash !== digest(p))
      throw new AppError(
        "CONFIRMATION_INVALID",
        "Confirmation does not match",
        409,
      );
    return { confirmed: true };
  }
  async consume(r: string, id: string) {
    const row = (
      await this.db.query(
        "UPDATE action_confirmations SET status='CONSUMED',consumed_at=NOW() WHERE id=$1 AND restaurant_id=$2 AND status='CONFIRMED' RETURNING id",
        [id, r],
      )
    ).rows[0];
    if (!row)
      throw new AppError(
        "CONFIRMATION_REQUIRED",
        "Explicit confirmation is required",
        409,
      );
  }
  async consumeTx(tx: Tx, r: string, id: string, actions: SensitiveAction[]) {
    const row = (await tx.query(
      "UPDATE action_confirmations SET status='CONSUMED',consumed_at=NOW() WHERE id=$1 AND restaurant_id=$2 AND action=ANY($3::text[]) AND status='CONFIRMED' AND expires_at>NOW() RETURNING id",
      [id, r, actions],
    )).rows[0];
    if (!row) throw new AppError("CONFIRMATION_REQUIRED", "Explicit confirmation is required", 409);
  }
}
export class ReservationAvailabilityService {
  constructor(private db: Db) {}
  async check(
    r: string,
    i: { date: string; time: string; partySize: number; excludeId?: string },
  ) {
    const x = (
      await this.db.query<ReservationSettingsRow>(
        "SELECT r.timezone,r.status,s.* FROM restaurants r LEFT JOIN reservation_settings s ON s.restaurant_id=r.id WHERE r.id=$1",
        [r],
      )
    ).rows[0];
    if (!x || x.status !== "ACTIVE")
      return { available: false, reason: "RESTAURANT_UNAVAILABLE" };
    if (!x.accept_reservations)
      return { available: false, reason: "RESERVATIONS_DISABLED" };
    const d = DateTime.fromISO(`${i.date}T${i.time}`, {
        zone: x.timezone,
        setZone: true,
      }),
      now = DateTime.now().setZone(x.timezone);
    if (!d.isValid) return { available: false, reason: "INVALID_DATETIME" };
    const days = d.startOf("day").diff(now.startOf("day"), "days").days;
    if (
      days < 0 ||
      days > x.advance_booking_days ||
      (days === 0 && !x.same_day_booking_allowed) ||
      d.diff(now, "minutes").minutes < x.minimum_notice_minutes
    )
      return { available: false, reason: "BOOKING_WINDOW" };
    if (
      i.partySize < x.minimum_party_size ||
      i.partySize > x.maximum_party_size
    )
      return { available: false, reason: "PARTY_SIZE_INVALID" };
    const weekday = d.weekday % 7;
    const hours = (
      await this.db.query<{ start_time: string; end_time: string }>(
        "SELECT start_time::text,end_time::text FROM business_hours WHERE restaurant_id=$1 AND weekday=$2",
        [r, weekday],
      )
    ).rows;
    if (
      !hours.length ||
      !hours.some(
        (h) =>
          i.time >= h.start_time.slice(0, 5) && i.time < h.end_time.slice(0, 5),
      )
    )
      return { available: false, reason: "OUTSIDE_BUSINESS_HOURS" };
    const closure = (
      await this.db.query(
        "SELECT 1 FROM special_closures WHERE restaurant_id=$1 AND closure_date=$2::date AND active=true AND (start_time IS NULL OR ($3::time >= start_time AND $3::time < end_time))",
        [r, i.date, i.time],
      )
    ).rows[0];
    if (closure) return { available: false, reason: "RESTAURANT_CLOSED" };
    const conflict = (
      await this.db.query(
        "SELECT id FROM reservations WHERE restaurant_id=$1 AND status IN ('PENDING','CONFIRMED') AND reservation_date=$2::date AND reservation_time=$3::time AND ($4::uuid IS NULL OR id<>$4) AND party_size+$5>$6",
        [
          r,
          i.date,
          i.time,
          i.excludeId ?? null,
          i.partySize,
          x.capacity_per_slot,
        ],
      )
    ).rows[0];
    return conflict
      ? { available: false, reason: "CAPACITY_EXCEEDED" }
      : {
          available: true,
          date: i.date,
          time: i.time,
          partySize: i.partySize,
          reason: null,
        };
  }
}
export class ActionEngine {
  readonly confirmations: ReservationConfirmationService;
  readonly availability: ReservationAvailabilityService;
  constructor(private db: Db) {
    this.confirmations = new ReservationConfirmationService(db);
    this.availability = new ReservationAvailabilityService(db);
  }
  async createReservation(
    c: ActionContext,
    input: unknown,
    confirmationId: string,
    existingTx?: Tx,
  ) {
    const d = reservationInput.parse(input),
      a = await this.availability.check(c.restaurantId, d);
    if (!a.available)
      throw new AppError(String(a.reason), "Reservation is unavailable", 409);
    const run = async (tx: Tx) => {
      await this.confirmations.consumeTx(tx, c.restaurantId, confirmationId, ["CREATE_RESERVATION"]);
      await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        `reservation:${c.restaurantId}:${d.date}:${d.time}`,
      ]);
      const capacity = await tx.query<{ capacity_per_slot: number }>(
        "SELECT capacity_per_slot FROM reservation_settings WHERE restaurant_id=$1",
        [c.restaurantId],
      );
      const used = await tx.query<{ party_size: number }>(
        "SELECT COALESCE(SUM(party_size),0)::int party_size FROM reservations WHERE restaurant_id=$1 AND reservation_date=$2::date AND reservation_time=$3::time AND status IN ('PENDING','CONFIRMED')",
        [c.restaurantId, d.date, d.time],
      );
      if (
        (used.rows[0]?.party_size ?? 0) + d.partySize >
        (capacity.rows[0]?.capacity_per_slot ?? 0)
      )
        throw new AppError(
          "CAPACITY_EXCEEDED",
          "Reservation is unavailable",
          409,
        );
      const id = randomUUID(),
        code = randomUUID().slice(0, 6).toUpperCase();
      const row = (
        await tx.query(
          "INSERT INTO reservations(id,restaurant_id,confirmation_code,status,guest_name,guest_phone,guest_email,party_size,reservation_date,reservation_time,duration_minutes,special_request,source,conversation_id) SELECT $1,$2,$3,'CONFIRMED',$4,$5,$6,$7,$8,$9,COALESCE(default_duration_minutes,90),$10,'AI_PHONE',$11 FROM reservation_settings WHERE restaurant_id=$2 RETURNING id,confirmation_code,reservation_date,reservation_time,party_size",
          [
            id,
            c.restaurantId,
            code,
            d.guestName,
            normalizePhone(d.guestPhone),
            d.guestEmail ?? null,
            d.partySize,
            d.date,
            d.time,
            d.specialRequest ?? null,
            c.conversationId ?? null,
          ],
        )
      ).rows[0];
      if (!row)
        throw new AppError(
          "RESERVATION_SETTINGS_MISSING",
          "Reservation settings are not configured",
          409,
        );
      await this.event(tx, c, id, "CREATED");
      return { success: true, reservation: row };
    };
    return existingTx ? run(existingTx) : withTransaction(this.db, run);
  }
  async findReservation(
    r: string,
    i: { confirmationCode?: string; phone?: string },
  ) {
    const rows = (
      await this.db.query(
        "SELECT * FROM reservations WHERE restaurant_id=$1 AND ($2::text IS NULL OR confirmation_code=$2) AND ($3::text IS NULL OR guest_phone=$3) ORDER BY created_at DESC",
        [
          r,
          i.confirmationCode ?? null,
          i.phone ? normalizePhone(i.phone) : null,
        ],
      )
    ).rows;
    return rows.length === 1
      ? { found: true, reservation: rows[0] }
      : {
          found: false,
          reason: rows.length ? "AMBIGUOUS_IDENTIFICATION" : "NOT_FOUND",
        };
  }
  async modifyReservation(
    c: ActionContext,
    id: string,
    input: unknown,
    confirmationId: string,
    existingTx?: Tx,
  ) {
    const d = reservationInput
        .partial()
        .required({ partySize: true, date: true, time: true })
        .parse(input),
      a = await this.availability.check(c.restaurantId, {
        ...d,
        excludeId: id,
      });
    if (!a.available)
      throw new AppError(String(a.reason), "Reservation is unavailable", 409);
    const run = async (tx: Tx) => {
      await this.confirmations.consumeTx(tx, c.restaurantId, confirmationId, ["MODIFY_RESERVATION"]);
      await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        `reservation:${c.restaurantId}:${d.date}:${d.time}`,
      ]);
      const capacity = await tx.query<{ capacity_per_slot: number }>(
        "SELECT capacity_per_slot FROM reservation_settings WHERE restaurant_id=$1",
        [c.restaurantId],
      );
      const used = await tx.query<{ party_size: number }>(
        "SELECT COALESCE(SUM(party_size),0)::int party_size FROM reservations WHERE restaurant_id=$1 AND reservation_date=$2::date AND reservation_time=$3::time AND status IN ('PENDING','CONFIRMED') AND id<>$4",
        [c.restaurantId, d.date, d.time, id],
      );
      if (
        (used.rows[0]?.party_size ?? 0) + d.partySize >
        (capacity.rows[0]?.capacity_per_slot ?? 0)
      )
        throw new AppError(
          "CAPACITY_EXCEEDED",
          "Reservation is unavailable",
          409,
        );
      const row = (
        await tx.query(
          "UPDATE reservations SET guest_name=COALESCE($3,guest_name),guest_phone=COALESCE($4,guest_phone),guest_email=COALESCE($5,guest_email),party_size=$6,reservation_date=$7,reservation_time=$8,special_request=COALESCE($9,special_request),updated_at=NOW() WHERE id=$1 AND restaurant_id=$2 AND status IN ('PENDING','CONFIRMED') RETURNING id,confirmation_code,reservation_date,reservation_time,party_size",
          [
            id,
            c.restaurantId,
            d.guestName ?? null,
            d.guestPhone ? normalizePhone(d.guestPhone) : null,
            d.guestEmail ?? null,
            d.partySize,
            d.date,
            d.time,
            d.specialRequest ?? null,
          ],
        )
      ).rows[0];
      if (!row)
        throw new AppError(
          "RESERVATION_NOT_FOUND",
          "Reservation not found",
          404,
        );
      await this.event(tx, c, id, "MODIFIED");
      return { success: true, reservation: row };
    };
    return existingTx ? run(existingTx) : withTransaction(this.db, run);
  }
  async cancelReservation(
    c: ActionContext,
    id: string,
    confirmationId: string,
    existingTx?: Tx,
  ) {
    const run = async (tx: Tx) => {
      await this.confirmations.consumeTx(tx, c.restaurantId, confirmationId, ["CANCEL_RESERVATION"]);
      const row = (
        await tx.query(
          "UPDATE reservations SET status='CANCELLED',cancelled_at=NOW(),updated_at=NOW() WHERE id=$1 AND restaurant_id=$2 AND status IN ('PENDING','CONFIRMED') RETURNING id,confirmation_code",
          [id, c.restaurantId],
        )
      ).rows[0];
      if (!row)
        throw new AppError(
          "RESERVATION_NOT_FOUND",
          "Reservation not found",
          404,
        );
      await this.event(tx, c, id, "CANCELLED");
      return { success: true, reservation: row };
    };
    return existingTx ? run(existingTx) : withTransaction(this.db, run);
  }
  private async event(tx: Tx, c: ActionContext, id: string, type: string) {
    await tx.query(
      "INSERT INTO reservation_events(id,reservation_id,restaurant_id,event_type,actor_type,metadata) VALUES($1,$2,$3,$4,$5,$6)",
      [
        randomUUID(),
        id,
        c.restaurantId,
        type,
        c.actorType,
        JSON.stringify({ conversationId: c.conversationId }),
      ],
    );
    await tx.query(
      "INSERT INTO audit_events(id,restaurant_id,actor_type,action,entity_type,entity_id,conversation_id,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        randomUUID(),
        c.restaurantId,
        c.actorType,
        type,
        "RESERVATION",
        id,
        c.conversationId ?? null,
        "{}",
      ],
    );
    await tx.query(
      "INSERT INTO outbox_events(id,restaurant_id,event_type,aggregate_type,aggregate_id,payload) SELECT $1,$2,$3,'RESERVATION',$4,jsonb_build_object('phone',guest_phone,'confirmationCode',confirmation_code,'date',reservation_date,'time',reservation_time) FROM reservations WHERE id=$4 AND restaurant_id=$2 ON CONFLICT DO NOTHING",
      [randomUUID(), c.restaurantId, `RESERVATION_${type}`, id],
    );
  }
}
