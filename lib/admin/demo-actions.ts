"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";

export async function loadDemoDataAction(): Promise<{ error?: string; success?: true }> {
  const { supabase } = await requireAdmin("action:loadDemoData");
  const { error } = await supabase.rpc("admin_load_demo_data");

  if (error) return { error: "Demo verisi yüklenemedi: " + error.message };

  revalidatePath("/admin");
  revalidatePath("/kesfet");
  revalidatePath("/bu-aksam");
  revalidatePath("/etkinlikler");
  return { success: true };
}

export async function clearDemoDataAction(): Promise<{ error?: string; success?: true }> {
  const { supabase } = await requireAdmin("action:clearDemoData");
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
  // "use server" dosyasından export edildiği için bu da istemciden çağrılabilir.
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_demo_data_summary");

  if (error || !data) {
    return { loaded: false, businesses: 0, users: 0, packages: 0, purchases: 0 };
  }

  return data as DemoDataSummary;
}
