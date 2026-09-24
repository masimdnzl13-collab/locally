import type { Db } from '../db/database.js';
export class FAQService { constructor(private db: Db) {} list(restaurantId: string) { return this.db.prepare('SELECT * FROM faqs WHERE restaurant_id=? AND active=1 ORDER BY priority DESC,display_order,question').all(restaurantId); } }
