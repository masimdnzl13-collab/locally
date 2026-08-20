import Anthropic from "@anthropic-ai/sdk";
import type { CampaignTone } from "@/lib/ai/types";
import { BUSINESS_CATEGORY_LABELS, type BusinessCategory } from "@/lib/types";
import { TONE_LABELS } from "@/lib/ai/types";

const MODEL = "claude-opus-4-8";

export function isAiConfigured() {
  return !!process.env.ANTHROPIC_API_KEY;
}

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

const SYSTEM_PROMPT = `Sen Locally uygulamasının işletmeler için kampanya metni yazan asistanısın.
Locally, Türkiye'deki restoran, kafe, otel, beach club ve etkinlik mekanlarının kullanılmayan
kapasitesini (son dakika masa, oda, bilet) indirimli paketler halinde satan yerel bir pazaryeridir.

Yazım kuralları — bunlara kesinlikle uy:
- Türkçe yaz. Abartılı, yanıltıcı ya da doğrulanamaz vaatlerde bulunma ("en iyi", "kaçırılmayacak fırsat",
  "%100 garanti" gibi ifadelerden kaçın).
- Fiyat bilgisi sana verilen gerçek rakamdır; asla farklı bir rakam uydurma.
- Marka sesi sıcak, yerel ve samimi ama iddiasız olsun — büyük şehir ajans diliyle değil, mahallenin
  işletmecisi gibi konuş.
- Metinler kısa ve doğrudan olsun, gereksiz süsleme yapma.
- SMS metni 160 karakteri kesinlikle aşmasın.
- Instagram metninde emoji ve en fazla 3-4 hashtag kullan, spam gibi görünmesin.
- Çıktıyı yalnızca istenen JSON şemasına uygun şekilde döndür, başka açıklama ekleme.`;

const TONE_HINT: Record<CampaignTone, string> = {
  samimi: "Sıcak, arkadaşça, 'sen' diliyle konuşan bir ton kullan.",
  sik: "Zarif, kısa cümleli, iddiasız ama kaliteli hissettiren bir ton kullan.",
  esprili: "Hafif esprili, gülümseten ama saygılı bir ton kullan; abartıya kaçma.",
};

interface PackageCopySchema {
  title: string;
  salesCopy: string;
  sms: string;
  instagram: string;
}

const PACKAGE_JSON_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "Vitrin için çekici paket başlığı, en fazla 60 karakter" },
    salesCopy: { type: "string", description: "İki-üç cümlelik satış metni" },
    sms: { type: "string", description: "160 karakteri geçmeyen SMS duyuru metni" },
    instagram: { type: "string", description: "Emoji ve hashtag içeren Instagram gönderi metni" },
  },
  required: ["title", "salesCopy", "sms", "instagram"],
  additionalProperties: false,
} as const;

export async function generatePackageCopyWithClaude(params: {
  businessName: string;
  category: BusinessCategory;
  content: string;
  salePrice: number;
  referencePrice?: number | null;
  tone: CampaignTone;
}): Promise<PackageCopySchema> {
  const client = getClient();
  const categoryLabel = BUSINESS_CATEGORY_LABELS[params.category] ?? params.category;

  const priceText = params.referencePrice && params.referencePrice > params.salePrice
    ? `${params.salePrice}₺ (yaz/normal referans fiyatı ${params.referencePrice}₺)`
    : `${params.salePrice}₺`;

  const userPrompt = `İşletme adı: ${params.businessName}
Kategori: ${categoryLabel}
Paket içeriği: ${params.content || "(işletmeci henüz açıklama girmedi, genel bir içerikten söz et)"}
Gerçek satış fiyatı: ${priceText}
Ton tercihi: ${TONE_LABELS[params.tone]} — ${TONE_HINT[params.tone]}

Bu paket için vitrin başlığı, satış metni, SMS duyuru metni ve Instagram gönderi metni üret.`;

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
    output_config: { format: { type: "json_schema", schema: PACKAGE_JSON_SCHEMA } },
  });

  if (!response.parsed_output) {
    throw new Error("Model geçerli bir yanıt üretmedi.");
  }

  return response.parsed_output as PackageCopySchema;
}

interface AnnouncementCopySchema {
  message: string;
}

const ANNOUNCEMENT_JSON_SCHEMA = {
  type: "object",
  properties: {
    message: {
      type: "string",
      description: "Hedef kitleye uygun duyuru mesajı; {{isim}} yer tutucusunu içerebilir",
    },
  },
  required: ["message"],
  additionalProperties: false,
} as const;

const SEGMENT_LABELS: Record<string, string> = {
  tumu: "tüm müşteriler",
  yeni: "bu ay ilk kez gelen yeni müşteriler",
  sadik: "3 veya daha fazla kez gelen sadık müşteriler",
  uyuyan: "30 günden uzun süredir gelmeyen, uykuya dalmış müşteriler",
};

export async function generateAnnouncementCopyWithClaude(params: {
  businessName: string;
  category: BusinessCategory;
  segment: string;
  tone: CampaignTone;
}): Promise<AnnouncementCopySchema> {
  const client = getClient();
  const categoryLabel = BUSINESS_CATEGORY_LABELS[params.category] ?? params.category;
  const segmentLabel = SEGMENT_LABELS[params.segment] ?? params.segment;

  const userPrompt = `İşletme adı: ${params.businessName}
Kategori: ${categoryLabel}
Hedef kitle: ${segmentLabel}
Ton tercihi: ${TONE_LABELS[params.tone]} — ${TONE_HINT[params.tone]}

Bu hedef kitleye gönderilecek kısa bir duyuru mesajı yaz. Müşterinin adını kişiselleştirmek için
metnin içinde tam olarak {{isim}} yer tutucusunu kullan. Mesaj SMS ve e-posta için de kullanılabilecek
kadar kısa olsun (tercihen 200 karakter altı).`;

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
    output_config: { format: { type: "json_schema", schema: ANNOUNCEMENT_JSON_SCHEMA } },
  });

  if (!response.parsed_output) {
    throw new Error("Model geçerli bir yanıt üretmedi.");
  }

  return response.parsed_output as AnnouncementCopySchema;
}
