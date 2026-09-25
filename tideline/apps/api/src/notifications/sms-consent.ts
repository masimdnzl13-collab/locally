import type { Db } from "../database/db.js";
import { toE164 } from "./sms-keywords.js";

/** Records an opt-out/opt-in for one customer of one restaurant. Shared by the inbound webhook and the 21610 path. */
export async function setSmsConsent(
  db: Db,
  input: { restaurantId: string; phone: string; consent: boolean; source: "sms_keyword" | "carrier" },
) {
  await db.query(
    "INSERT INTO customer_sms_preferences(restaurant_id,phone,consent,consent_source,opted_out_at) VALUES($1,$2,$3,$4,CASE WHEN $3 THEN NULL ELSE NOW() END) ON CONFLICT(restaurant_id,phone) DO UPDATE SET consent=EXCLUDED.consent,consent_source=EXCLUDED.consent_source,opted_out_at=EXCLUDED.opted_out_at,updated_at=NOW()",
    [input.restaurantId, toE164(input.phone), input.consent, input.source],
  );
}

/**
 * The customer's SMS preference at one restaurant. Looked up by both the stored spelling and E.164
 * (older rows may hold "(555) 123-4567"); if any matching row says no, the answer is no.
 */
export async function smsPreference(db: Db, restaurantId: string, phone: string) {
  return (
    await db.query<{ consent: boolean; language: "EN" | "ES" }>(
      "SELECT consent,language FROM customer_sms_preferences WHERE restaurant_id=$1 AND phone IN ($2,$3) ORDER BY consent ASC LIMIT 1",
      [restaurantId, phone, toE164(phone)],
    )
  ).rows[0];
}
