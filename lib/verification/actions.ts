"use server";

import { createClient } from "@/lib/supabase/server";

export interface VerifyResult {
  success: boolean;
  error_code?: string;
  message?: string;
  customer_name?: string;
  detail?: string;
  code_type: "package" | "flash" | "ticket" | "unknown";
  data?: {
    package_title?: string;
    remaining_uses?: number;
    usage_count?: number;
    offer_text?: string;
    event_title?: string;
  };
}

function friendlyRpcError(message: string): string {
  if (message.includes("NOT_BUSINESS")) return "İşletme hesabı bulunamadı.";
  if (message.includes("NOT_AUTHENTICATED")) return "Giriş yapmalısın.";
  return "Doğrulanamadı, tekrar dener misin?";
}

export async function verifyCodeAction(
  formData: FormData
): Promise<{ error?: string; result?: VerifyResult }> {
  const code = String(formData.get("code") ?? "").trim();
  if (!code) return { error: "Kod boş olamaz." };

  const supabase = createClient();
  const { data, error } = await supabase.rpc("verify_code", { p_code: code });

  if (error) return { error: friendlyRpcError(error.message) };

  return { result: data as VerifyResult };
}
