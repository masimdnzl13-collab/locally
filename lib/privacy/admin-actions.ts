"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";

// AO — /admin/gizlilik-talepleri kuyruğunda talebin durumunu ve iç notunu günceller.
const STATUSES = ["new", "in_progress", "completed", "rejected"] as const;
type Status = (typeof STATUSES)[number];
const PATH = "/admin/gizlilik-talepleri";

export async function updatePrivacyRequestAction(formData: FormData): Promise<{ error?: string; success?: true }> {
  const { supabase, userId } = await requireAdmin("action:updatePrivacyRequest");
  const id = String(formData.get("requestId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim() as Status;
  const note = String(formData.get("adminNote") ?? "").trim().slice(0, 2000);
  if (!id || !STATUSES.includes(status)) return { error: "Geçersiz istek." };

  const closed = status === "completed" || status === "rejected";
  const { error } = await supabase
    .from("privacy_requests")
    .update({
      status,
      admin_note: note || null,
      resolved_at: closed ? new Date().toISOString() : null,
      resolved_by: closed ? userId : null,
    })
    .eq("id", id);
  if (error) return { error: "Talep güncellenemedi." };
  revalidatePath(PATH);
  return { success: true };
}
