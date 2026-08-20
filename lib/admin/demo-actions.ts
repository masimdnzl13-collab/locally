"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function loadDemoDataAction(): Promise<{ error?: string; success?: true }> {
  const supabase = createClient();
  const { error } = await supabase.rpc("admin_load_demo_data");

  if (error) return { error: "Demo verisi yüklenemedi: " + error.message };

  revalidatePath("/admin");
  revalidatePath("/kesfet");
  revalidatePath("/bu-aksam");
  revalidatePath("/etkinlikler");
  return { success: true };
}

export async function clearDemoDataAction(): Promise<{ error?: string; success?: true }> {
  const supabase = createClient();
  const { error } = await supabase.rpc("admin_clear_demo_data");

  if (error) return { error: "Demo verisi temizlenemedi: " + error.message };

  revalidatePath("/admin");
  revalidatePath("/kesfet");
  revalidatePath("/bu-aksam");
  revalidatePath("/etkinlikler");
  return { success: true };
}

export interface DemoDataSummary {
  loaded: boolean;
  businesses: number;
  users: number;
  packages: number;
  purchases: number;
}

export async function getDemoDataSummary(): Promise<DemoDataSummary> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("admin_demo_data_summary");

  if (error || !data) {
    return { loaded: false, businesses: 0, users: 0, packages: 0, purchases: 0 };
  }

  return data as DemoDataSummary;
}
