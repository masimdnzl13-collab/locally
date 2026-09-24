import type { Business } from "@/lib/types";

// "Tideline" sekmesi yalnızca ABD pazarındaki, Tideline modülü admin
// tarafından açılmış VE bir Tideline restoranına eşlenmiş işletmelerde
// görünür (bkz. supabase/migrations/*_tideline_account_mapping.sql).
// Client-safe: hiçbir sır içermez, panel menüsü de bunu kullanır.
export function hasTidelineAccess(
  business: Pick<Business, "market" | "active_modules" | "tideline_restaurant_id">
): boolean {
  return (
    business.market === "US" &&
    (business.active_modules ?? []).includes("tideline") &&
    Boolean(business.tideline_restaurant_id)
  );
}
