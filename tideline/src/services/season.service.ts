import { DateTime } from 'luxon'; import type { Db } from '../db/database.js';
export type SeasonState = 'OPEN' | 'CLOSED' | 'TEMPORARILY_CLOSED';
export class SeasonService {
 constructor(private db: Db) {}
 get(restaurantId: string) { return this.db.prepare('SELECT * FROM seasons WHERE restaurant_id=?').get(restaurantId) as Record<string, unknown> | undefined; }
 status(restaurantId: string, timezone: string, at = DateTime.now()): SeasonState {
  const s = this.get(restaurantId); if (!s || !s.enabled) return 'OPEN'; if (s.current_status === 'TEMPORARILY_CLOSED') return 'TEMPORARILY_CLOSED';
  if (!s.season_start || !s.season_end) return s.current_status as SeasonState;
  const today = at.setZone(timezone).toISODate()!; const start = String(s.season_start); const end = String(s.season_end);
  const inRange = start <= end ? today >= start && today <= end : today >= start || today <= end;
  return inRange && s.current_status === 'OPEN' ? 'OPEN' : 'CLOSED';
 }
 operational(restaurantId: string, timezone: string, at?: any) { return this.status(restaurantId, timezone, at) === 'OPEN'; }
 message(restaurantId: string, timezone: string, at?: any) { const s = this.get(restaurantId); return this.operational(restaurantId, timezone, at) ? null : (s?.closed_message ?? 'We are currently closed.'); }
 permits(restaurantId: string, timezone: string, kind: 'orders'|'reservations', at?: any) { const s=this.get(restaurantId); return this.operational(restaurantId,timezone,at) || !(kind === 'orders' ? s?.disable_orders_when_closed : s?.disable_reservations_when_closed); }
}
