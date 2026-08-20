"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const SIMULATION_RPCS = [
  "admin_test_new_reservation",
  "admin_test_expire_package",
  "admin_test_fill_flash_quota",
  "admin_test_end_flash",
  "admin_test_add_historical_verification",
  "admin_test_set_business_pending",
  "admin_test_reset_lab_data",
] as const;

export type SimulationKind = (typeof SIMULATION_RPCS)[number];

const TEST_LAB_PATH = "/test-lab-k7m2p9x4";

export async function runSimulationAction(
  kind: SimulationKind
): Promise<{ error?: string; success?: true; message?: string }> {
  if (!SIMULATION_RPCS.includes(kind)) {
    return { error: "Bilinmeyen simülasyon." };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc(kind);

  if (error) {
    return { error: "Simülasyon başarısız: " + error.message };
  }

  revalidatePath(TEST_LAB_PATH);
  revalidatePath("/panel");
  revalidatePath("/panel/paketler");
  revalidatePath("/panel/bu-aksam");
  revalidatePath("/kesfet");
  revalidatePath("/bu-aksam");

  return { success: true, message: (data as { success?: boolean })?.success ? "Yapıldı." : undefined };
}
