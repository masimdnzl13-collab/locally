import type { Db } from "../database/db.js";

export class StatsService {
  constructor(private readonly db: Db) {}

  async overview(restaurantId: string) {
    const [calls, reservations, orders, notifications, menu, faqs, ai] = await Promise.all([
      this.db.query<{ total: string; last7d: string; completed: string; missed: string; avg_duration: string | null }>(
        `SELECT
           count(*) AS total,
           count(*) FILTER (WHERE started_at > NOW() - INTERVAL '7 days') AS last7d,
           count(*) FILTER (WHERE status = 'COMPLETED') AS completed,
           count(*) FILTER (WHERE status IN ('FAILED','NO_ANSWER','BUSY')) AS missed,
           avg(duration_seconds) FILTER (WHERE duration_seconds IS NOT NULL) AS avg_duration
         FROM calls WHERE restaurant_id=$1`,
        [restaurantId],
      ),
      this.db.query<{ total: string; upcoming: string; cancelled: string; no_show: string }>(
        `SELECT
           count(*) AS total,
           count(*) FILTER (WHERE status IN ('PENDING','CONFIRMED') AND reservation_date >= CURRENT_DATE) AS upcoming,
           count(*) FILTER (WHERE status = 'CANCELLED') AS cancelled,
           count(*) FILTER (WHERE status = 'NO_SHOW') AS no_show
         FROM reservations WHERE restaurant_id=$1`,
        [restaurantId],
      ),
      this.db.query<{ total: string; last7d: string; revenue_cents: string | null; last7d_revenue_cents: string | null; cancelled: string }>(
        `SELECT
           count(*) AS total,
           count(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') AS last7d,
           sum(total_cents) FILTER (WHERE status <> 'CANCELLED') AS revenue_cents,
           sum(total_cents) FILTER (WHERE status <> 'CANCELLED' AND created_at > NOW() - INTERVAL '7 days') AS last7d_revenue_cents,
           count(*) FILTER (WHERE status = 'CANCELLED') AS cancelled
         FROM orders WHERE restaurant_id=$1`,
        [restaurantId],
      ),
      this.db.query<{ total: string; sent: string; failed: string }>(
        `SELECT count(*) AS total, count(*) FILTER (WHERE status='SENT') AS sent, count(*) FILTER (WHERE status='FAILED') AS failed
         FROM notifications WHERE restaurant_id=$1`,
        [restaurantId],
      ),
      this.db.query<{ categories: string; items: string; active_items: string }>(
        `SELECT
           (SELECT count(*) FROM menu_categories WHERE restaurant_id=$1) AS categories,
           (SELECT count(*) FROM menu_items WHERE restaurant_id=$1) AS items,
           (SELECT count(*) FROM menu_items WHERE restaurant_id=$1 AND active AND available) AS active_items`,
        [restaurantId],
      ),
      this.db.query<{ total: string }>("SELECT count(*) AS total FROM faqs WHERE restaurant_id=$1", [restaurantId]),
      this.db.query<{ conversations: string; total_tokens: string | null; estimated_cost: string | null }>(
        `SELECT count(DISTINCT conversation_id) AS conversations, sum(total_tokens) AS total_tokens, sum(estimated_cost) AS estimated_cost
         FROM ai_usage WHERE restaurant_id=$1`,
        [restaurantId],
      ),
    ]);
    const c = calls.rows[0],
      r = reservations.rows[0],
      o = orders.rows[0],
      n = notifications.rows[0],
      m = menu.rows[0],
      f = faqs.rows[0],
      a = ai.rows[0];
    return {
      calls: {
        total: Number(c.total),
        last7d: Number(c.last7d),
        completed: Number(c.completed),
        missed: Number(c.missed),
        avgDurationSeconds: c.avg_duration ? Math.round(Number(c.avg_duration)) : 0,
      },
      reservations: {
        total: Number(r.total),
        upcoming: Number(r.upcoming),
        cancelled: Number(r.cancelled),
        noShow: Number(r.no_show),
      },
      orders: {
        total: Number(o.total),
        last7d: Number(o.last7d),
        revenueCents: Number(o.revenue_cents ?? 0),
        last7dRevenueCents: Number(o.last7d_revenue_cents ?? 0),
        cancelled: Number(o.cancelled),
      },
      notifications: {
        total: Number(n.total),
        sent: Number(n.sent),
        failed: Number(n.failed),
        deliveryRate: Number(n.total) > 0 ? Number(n.sent) / Number(n.total) : null,
      },
      menu: {
        categories: Number(m.categories),
        items: Number(m.items),
        activeItems: Number(m.active_items),
      },
      faqs: Number(f.total),
      ai: {
        conversations: Number(a.conversations),
        totalTokens: Number(a.total_tokens ?? 0),
        estimatedCostUsd: Number(a.estimated_cost ?? 0),
      },
    };
  }

  async timeseries(restaurantId: string, days: number) {
    const [calls, orders, reservations] = await Promise.all([
      this.db.query<{ day: string; count: string }>(
        `SELECT to_char(d.day,'YYYY-MM-DD') AS day, count(c.id) AS count
         FROM generate_series(CURRENT_DATE - ($2::int - 1), CURRENT_DATE, INTERVAL '1 day') AS d(day)
         LEFT JOIN calls c ON c.restaurant_id=$1 AND c.started_at::date = d.day
         GROUP BY d.day ORDER BY d.day`,
        [restaurantId, days],
      ),
      this.db.query<{ day: string; revenue_cents: string }>(
        `SELECT to_char(d.day,'YYYY-MM-DD') AS day, coalesce(sum(o.total_cents) FILTER (WHERE o.status <> 'CANCELLED'),0) AS revenue_cents
         FROM generate_series(CURRENT_DATE - ($2::int - 1), CURRENT_DATE, INTERVAL '1 day') AS d(day)
         LEFT JOIN orders o ON o.restaurant_id=$1 AND o.created_at::date = d.day
         GROUP BY d.day ORDER BY d.day`,
        [restaurantId, days],
      ),
      this.db.query<{ day: string; count: string }>(
        `SELECT to_char(d.day,'YYYY-MM-DD') AS day, count(r.id) AS count
         FROM generate_series(CURRENT_DATE - ($2::int - 1), CURRENT_DATE, INTERVAL '1 day') AS d(day)
         LEFT JOIN reservations r ON r.restaurant_id=$1 AND r.created_at::date = d.day
         GROUP BY d.day ORDER BY d.day`,
        [restaurantId, days],
      ),
    ]);
    return {
      calls: calls.rows.map((x) => ({ day: x.day, count: Number(x.count) })),
      revenueCents: orders.rows.map((x) => ({ day: x.day, value: Number(x.revenue_cents) })),
      reservations: reservations.rows.map((x) => ({ day: x.day, count: Number(x.count) })),
    };
  }

  async recentCalls(restaurantId: string, limit: number) {
    return (
      await this.db.query(
        `SELECT id,caller_phone_number,direction,status,started_at,ended_at,duration_seconds,language,initial_intent
         FROM calls WHERE restaurant_id=$1 ORDER BY started_at DESC LIMIT $2`,
        [restaurantId, limit],
      )
    ).rows;
  }

  async recentOrders(restaurantId: string, limit: number) {
    return (
      await this.db.query(
        `SELECT id,order_number,status,customer_name,order_type,total_cents,currency,created_at
         FROM orders WHERE restaurant_id=$1 ORDER BY created_at DESC LIMIT $2`,
        [restaurantId, limit],
      )
    ).rows;
  }

  async recentReservations(restaurantId: string, limit: number) {
    return (
      await this.db.query(
        `SELECT id,confirmation_code,status,guest_name,guest_phone,party_size,reservation_date,reservation_time,created_at
         FROM reservations WHERE restaurant_id=$1 ORDER BY reservation_date DESC, reservation_time DESC LIMIT $2`,
        [restaurantId, limit],
      )
    ).rows;
  }

  /**
   * The owner-facing weekly summary shown in Locally's panel (/panel/rapor): what the AI did for
   * this restaurant in the last `days` days. Read-only and restaurant-scoped; callers run it
   * inside the restaurant's tenant context.
   *  - calls: all AI-handled calls started in the window
   *  - convertedCalls: calls that produced at least one order or reservation (originating_call_id)
   *  - topIntents: what callers asked about, counted once per conversation, ignoring
   *    greetings/goodbyes/unclassified turns
   */
  async weeklyReport(restaurantId: string, days = 7) {
    const since = `${days} days`;
    const [calls, converted, orders, reservations, intents] = await Promise.all([
      this.db.query<{ total: string; avg_duration: string | null }>(
        `SELECT count(*) AS total, avg(duration_seconds) FILTER (WHERE duration_seconds IS NOT NULL) AS avg_duration
         FROM calls WHERE restaurant_id=$1 AND started_at > NOW() - $2::interval`,
        [restaurantId, since],
      ),
      this.db.query<{ total: string }>(
        `SELECT count(*) AS total FROM calls c
         WHERE c.restaurant_id=$1 AND c.started_at > NOW() - $2::interval
           AND (EXISTS (SELECT 1 FROM orders o WHERE o.originating_call_id=c.id)
             OR EXISTS (SELECT 1 FROM reservations r WHERE r.originating_call_id=c.id))`,
        [restaurantId, since],
      ),
      this.db.query<{ total: string }>(
        "SELECT count(*) AS total FROM orders WHERE restaurant_id=$1 AND originating_call_id IS NOT NULL AND created_at > NOW() - $2::interval",
        [restaurantId, since],
      ),
      this.db.query<{ total: string }>(
        "SELECT count(*) AS total FROM reservations WHERE restaurant_id=$1 AND originating_call_id IS NOT NULL AND created_at > NOW() - $2::interval",
        [restaurantId, since],
      ),
      this.db.query<{ intent: string; conversations: string }>(
        `SELECT t.intent, count(DISTINCT t.conversation_id) AS conversations
         FROM conversation_turns t JOIN conversations c ON c.id=t.conversation_id
         WHERE c.restaurant_id=$1 AND t.created_at > NOW() - $2::interval
           AND t.intent NOT IN ('GREETING','GOODBYE','UNKNOWN')
         GROUP BY t.intent ORDER BY conversations DESC, t.intent ASC LIMIT 3`,
        [restaurantId, since],
      ),
    ]);
    const avg = calls.rows[0]?.avg_duration;
    return {
      days,
      calls: Number(calls.rows[0]?.total ?? 0),
      convertedCalls: Number(converted.rows[0]?.total ?? 0),
      orders: Number(orders.rows[0]?.total ?? 0),
      reservations: Number(reservations.rows[0]?.total ?? 0),
      avgDurationSeconds: avg ? Math.round(Number(avg)) : null,
      topIntents: intents.rows.map((r) => ({ intent: r.intent, conversations: Number(r.conversations) })),
    };
  }
}
