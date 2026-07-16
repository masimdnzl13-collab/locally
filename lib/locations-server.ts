import { cookies } from "next/headers";
import { CITY_COOKIE, DEFAULT_TOWN, TOWNS, isKnownTown, type Town } from "@/lib/locations";

/** Reads the visitor's selected seasonal destination from the city cookie, server-side. */
export function getSelectedCity(): string {
  const value = cookies().get(CITY_COOKIE)?.value;
  return value && isKnownTown(value) ? value : DEFAULT_TOWN.label;
}

export function getSelectedTown(): Town {
  const city = getSelectedCity();
  return TOWNS.find((t) => t.label === city) ?? DEFAULT_TOWN;
}
