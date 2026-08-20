import type { AnnouncementCopyResult, CampaignTone, PackageCopyResult } from "@/lib/ai/types";
import { BUSINESS_CATEGORY_LABELS, type BusinessCategory } from "@/lib/types";
import type { Segment } from "@/lib/customers/segments";

// ANTHROPIC_API_KEY tanımlı değilken (yerel geliştirme, henüz kurulmamış
// ortam) arayüzün boş kalmaması için sabit ama gerçek verilerle
// (fiyat, işletme adı) doldurulmuş örnek metinler üretir.

function priceLine(salePrice: number, referencePrice?: number | null) {
  if (referencePrice && referencePrice > salePrice) {
    return `${salePrice}₺ (yaz fiyatı ${referencePrice}₺)`;
  }
  return `${salePrice}₺`;
}

export function demoPackageCopy(params: {
  businessName: string;
  category: BusinessCategory;
  content: string;
  salePrice: number;
  referencePrice?: number | null;
  tone: CampaignTone;
}): PackageCopyResult {
  const categoryLabel = BUSINESS_CATEGORY_LABELS[params.category] ?? "işletme";
  const price = priceLine(params.salePrice, params.referencePrice);

  return {
    title: `${params.businessName} Özel: ${categoryLabel} Fırsatı`,
    salesCopy: `${params.businessName}'de ${params.content || "seçili menü"} artık ${price}. Kontenjan sınırlı, yerini şimdiden ayırt.`,
    sms: `${params.businessName}: ${params.content || "yeni paket"} ${price}. Detay: locally.app`,
    instagram: `${params.businessName}'de bugün seni bekleyen fırsat 🌊 ${params.content || "yeni paket"} sadece ${price}! Kaçırma ✨ #locally #${params.category}`,
    demo: true,
  };
}

const SEGMENT_DEMO_HOOK: Record<Segment, string> = {
  tumu: "Seni özledik",
  yeni: "Aramıza hoş geldin",
  sadik: "Sadık müşterimize özel",
  uyuyan: "Seni tekrar ağırlamak isteriz",
};

export function demoAnnouncementCopy(params: {
  businessName: string;
  segment: Segment;
  tone: CampaignTone;
}): AnnouncementCopyResult {
  const hook = SEGMENT_DEMO_HOOK[params.segment];
  return {
    message: `${hook}, {{isim}}! ${params.businessName} olarak seni yakında ağırlamak isteriz. Detaylar için uygulamayı aç.`,
    demo: true,
  };
}
