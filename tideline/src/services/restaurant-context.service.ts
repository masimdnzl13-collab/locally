import type { Db } from '../db/database.js';
import { parseJson } from '../db/database.js';
import { MenuService } from './menu.service.js';
import { BusinessHoursService } from './business-hours.service.js';
import { SeasonService } from './season.service.js';
import { FAQService } from './faq.service.js';
import { RestaurantSettingsService } from './restaurant-settings.service.js';
import { ReservationRulesService } from './reservation-rules.service.js';

export class RestaurantContextService {
 constructor(private db:Db, private menu=new MenuService(db), private season=new SeasonService(db), private hours=new BusinessHoursService(db,season), private faqs=new FAQService(db), private settings=new RestaurantSettingsService(db), private reservations=new ReservationRulesService(db)) {}
 get(restaurantId:string) {
  const restaurant=this.db.prepare('SELECT * FROM restaurants WHERE id=?').get(restaurantId) as any;
  if(!restaurant) return null;
  const q=(sql:string)=>this.db.prepare(sql).all(restaurantId);
  const state=this.season.status(restaurantId,restaurant.timezone);
  return {restaurant:{...restaurant,supported_languages:parseJson(restaurant.supported_languages,[])},current_status:{restaurant_status:restaurant.status,season:state,season_message:this.season.message(restaurantId,restaurant.timezone),open_now:this.hours.isOpen(restaurantId,restaurant.timezone)},business_hours:q('SELECT * FROM business_hours WHERE restaurant_id=? ORDER BY weekday,start_time'),special_closures:q('SELECT * FROM special_closures WHERE restaurant_id=? AND active=1'),menu:this.menu.menu(restaurantId),specials:this.activeSpecials(restaurantId,restaurant.timezone),faqs:this.faqs.list(restaurantId),policies:q('SELECT * FROM policies WHERE restaurant_id=? AND active=1'),parking:this.settings.get(restaurantId,'parking'),directions:this.settings.get(restaurantId,'directions'),reservation_rules:this.reservations.get(restaurantId),human_escalation:this.settings.get(restaurantId,'human_escalation_settings'),ai_configuration:this.settings.get(restaurantId,'ai_configurations'),context_data_states:{allergens:'KNOWN only per explicit relationship; UNKNOWN when an item has no allergen records; NOT_CONFIGURED when the restaurant has no allergen records',dietary:'KNOWN only when explicitly provided'}};
 }
 activeSpecials(id:string, timezone:string) { const d=new Date().toLocaleDateString('en-CA',{timeZone:timezone}); return this.db.prepare("SELECT * FROM specials WHERE restaurant_id=? AND active=1 AND (start_date IS NULL OR start_date<=?) AND (end_date IS NULL OR end_date>=?)").all(id,d,d); }
}
