"use server";

import { createClient } from "@/lib/supabase/server";
import { getMyBusiness } from "@/lib/business/current";
import { generateAnnouncementCopyWithClaude, generatePackageCopyWithClaude, isAiConfigured } from "@/lib/ai/client";
import { demoAnnouncementCopy, demoPackageCopy } from "@/lib/ai/demo-content";
import type { AnnouncementCopyResult, CampaignTone, PackageCopyResult } from "@/lib/ai/types";
import type { Segment } from "@/lib/customers/segments";

function parseTone(formData: FormData): CampaignTone {
  const raw = String(formData.get("tone") ?? "samimi");
  return raw === "sik" || raw === "esprili" ? raw : "samimi";
}

async function logGeneration(businessId: string, kind: "paket" | "duyuru", tone: CampaignTone) {
  const supabase = createClient();
  await supabase.from("ai_generation_logs").insert({ business_id: businessId, kind, tone });
}

export async function generatePackageCopyAction(
  formData: FormData
): Promise<{ result?: PackageCopyResult; error?: string }> {
  const business = await getMyBusiness();
  if (!business) return { error: "Önce işletme profilini tamamlamalısın." };

  const content = String(formData.get("content") ?? "").trim();
  const salePrice = Number(formData.get("salePrice"));
  const referencePriceRaw = String(formData.get("referencePrice") ?? "").trim();
  const referencePrice = referencePriceRaw ? Number(referencePriceRaw) : null;
  const tone = parseTone(formData);

  if (!Number.isFinite(salePrice) || salePrice <= 0) {
    return { error: "Önce satış fiyatını gir, asistan gerçek fiyatı kullanır." };
  }

  const params = {
    businessName: business.name,
    category: business.category,
    content,
    salePrice,
    referencePrice,
    tone,
  };

  try {
    if (!isAiConfigured()) {
      await logGeneration(business.id, "paket", tone);
      return { result: demoPackageCopy(params) };
    }

    const generated = await generatePackageCopyWithClaude(params);
    await logGeneration(business.id, "paket", tone);
    return { result: { ...generated, demo: false } };
  } catch (err) {
    return { error: "Asistan şu anda yanıt üretemedi: " + (err as Error).message };
  }
}

export async function generateAnnouncementCopyAction(
  formData: FormData
): Promise<{ result?: AnnouncementCopyResult; error?: string }> {
  const business = await getMyBusiness();
  if (!business) return { error: "Önce işletme profilini tamamlamalısın." };

  const segment = String(formData.get("segment") ?? "tumu") as Segment;
  const tone = parseTone(formData);

  const params = { businessName: business.name, category: business.category, segment, tone };

  try {
    if (!isAiConfigured()) {
      await logGeneration(business.id, "duyuru", tone);
      return { result: demoAnnouncementCopy(params) };
    }

    const generated = await generateAnnouncementCopyWithClaude(params);
    await logGeneration(business.id, "duyuru", tone);
    return { result: { ...generated, demo: false } };
  } catch (err) {
    return { error: "Asistan şu anda yanıt üretemedi: " + (err as Error).message };
  }
}
