import type { Intent } from "./types.js";
export type Brain = {
  restaurantName?: string;
  timezone?: string;
  greeting: Record<string, string>;
  hours: unknown;
  menu: unknown[];
  policies: Record<string, unknown>;
  seasonalStatus: string;
  seasonalClosedMessage: Record<string, string>;
  humanTransfer: { enabled?: boolean; destination?: string };
  aiInstructions?: string;
};
export class RestaurantContextService {
  resolve(brain: Brain, intent: Intent) {
    if (brain.seasonalStatus !== "ACTIVE")
      return {
        state: "NOT_CONFIGURED" as const,
        summary: "Restaurant is seasonally unavailable.",
      };
    const value =
      intent === "HOURS"
        ? brain.hours
        : intent === "MENU" ||
            intent === "MENU_ITEM" ||
            intent === "ALLERGEN" ||
            intent === "DIETARY_QUESTION"
          ? brain.menu
          : intent === "PARKING"
            ? brain.policies.parking
            : intent === "SPECIALS"
              ? brain.policies.specials
              : intent === "RESTAURANT_INFO" || intent === "LOCATION"
                ? brain.policies
                : undefined;
    return value === undefined ||
      value === null ||
      (Array.isArray(value) && value.length === 0)
      ? {
          state: "NOT_CONFIGURED" as const,
          summary: "Requested restaurant information is not configured.",
        }
      : { state: "KNOWN" as const, summary: JSON.stringify(value) };
  }
}
