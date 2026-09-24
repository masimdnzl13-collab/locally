import type { Db } from '../db/database.js';
export class RestaurantSettingsService { constructor(private db: Db) {} get(restaurantId: string, table: string) { return this.db.prepare(`SELECT * FROM ${table} WHERE restaurant_id=?`).get(restaurantId) ?? { state: 'NOT_CONFIGURED' }; } }
