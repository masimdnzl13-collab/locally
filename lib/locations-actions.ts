"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { CITY_COOKIE, isKnownTown } from "@/lib/locations";

export async function setCityAction(city: string) {
  if (!isKnownTown(city)) return;
  cookies().set(CITY_COOKIE, city, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}
