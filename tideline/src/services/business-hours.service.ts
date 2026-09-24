import { DateTime } from 'luxon'; import type { Db } from '../db/database.js'; import { SeasonService } from './season.service.js';
export class BusinessHoursService {
 constructor(private db: Db, private season = new SeasonService(db)) {}
 isOpen(restaurantId: string, timezone: string, at = DateTime.now()) {
  const local=at.setZone(timezone); if (!this.season.operational(restaurantId, timezone, at)) return { open:false, reason:'SEASON_CLOSED' };
  const closure=this.db.prepare("SELECT * FROM special_closures WHERE restaurant_id=? AND date=? AND active=1 AND (start_time IS NULL OR (start_time <= ? AND (end_time IS NULL OR end_time > ?)))").get(restaurantId,local.toISODate(),local.toFormat('HH:mm'),local.toFormat('HH:mm'));
  if(closure) return {open:false,reason:'SPECIAL_CLOSURE',closure};
  const rows=this.db.prepare('SELECT * FROM business_hours WHERE restaurant_id=? AND weekday=?').all(restaurantId,local.weekday % 7) as Array<{start_time:string;end_time:string}>;
  return {open: rows.some(x=>x.start_time <= local.toFormat('HH:mm') && x.end_time > local.toFormat('HH:mm')), reason:'HOURS'};
 }
 intervals(restaurantId:string, weekday:number) { return this.db.prepare('SELECT * FROM business_hours WHERE restaurant_id=? AND weekday=? ORDER BY start_time').all(restaurantId,weekday); }
}
