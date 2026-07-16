import type { DiscoverPackage, PackageDetail } from "@/lib/packages/queries";
import type { FlashDeal } from "@/lib/flash-deals/queries";
import type { EventListItem, EventDetail } from "@/lib/events/queries";

// Preview-only content shown when a listing query returns no real rows yet
// (fresh project, no businesses onboarded). Mirrors supabase/seed-demo.sql
// so ids line up if that script is later run against a real project.
// No ratings, reviews, or attendance figures — the schema has none, and
// this data is marked `isDemo: true` so the UI never presents it as real.

const HOURS = 60 * 60 * 1000;
const DAYS = 24 * HOURS;
const now = () => Date.now();

export const DEMO_PACKAGES: DiscoverPackage[] = [
  {
    id: "33333333-3333-4333-8333-333333333301",
    title: "5 Kahve Paketi",
    sale_price: 350,
    summer_reference_price: 700,
    usage_count: 5,
    expires_at: new Date(now() + 45 * DAYS).toISOString(),
    purchasable: false,
    isDemo: true,
    business: {
      name: "Liman Kafe",
      slug: "liman-kafe-bodrum",
      district: "Gümbet",
      city: "Bodrum",
      category: "kafe",
      cover_url: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=1200&q=80",
    },
  },
  {
    id: "33333333-3333-4333-8333-333333333302",
    title: "Akşam Yemeği İkramı",
    sale_price: 650,
    summer_reference_price: 1600,
    usage_count: 1,
    expires_at: new Date(now() + 30 * DAYS).toISOString(),
    purchasable: false,
    isDemo: true,
    business: {
      name: "Rüzgar Sofrası",
      slug: "ruzgar-sofrasi-yalikavak",
      district: "Yalıkavak",
      city: "Bodrum",
      category: "restoran",
      cover_url: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=80",
    },
  },
  {
    id: "33333333-3333-4333-8333-333333333303",
    title: "3 Ders Sörf Paketi",
    sale_price: 1200,
    summer_reference_price: 2800,
    usage_count: 3,
    expires_at: new Date(now() + 60 * DAYS).toISOString(),
    purchasable: false,
    isDemo: true,
    business: {
      name: "Alaçatı Sörf Okulu",
      slug: "alacati-sorf-okulu",
      district: "Alaçatı",
      city: "Alaçatı",
      category: "aktivite",
      cover_url: "https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=1200&q=80",
    },
  },
  {
    id: "33333333-3333-4333-8333-333333333304",
    title: "Gece Konaklama",
    sale_price: 1800,
    summer_reference_price: 3600,
    usage_count: 1,
    expires_at: new Date(now() + 90 * DAYS).toISOString(),
    purchasable: false,
    isDemo: true,
    business: {
      name: "Taş Konak Alaçatı",
      slug: "tas-konak-alacati",
      district: "Alaçatı",
      city: "Alaçatı",
      category: "otel",
      cover_url: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200&q=80",
    },
  },
  {
    id: "33333333-3333-4333-8333-333333333305",
    title: "Gün Boyu Şezlong + İkram",
    sale_price: 450,
    summer_reference_price: 1100,
    usage_count: 1,
    expires_at: new Date(now() + 30 * DAYS).toISOString(),
    purchasable: false,
    isDemo: true,
    business: {
      name: "Çeşme Mavi Beach Club",
      slug: "cesme-mavi-beach-club",
      district: "Çeşme Merkez",
      city: "Çeşme",
      category: "beach_club",
      cover_url: "https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1200&q=80",
    },
  },
  {
    id: "33333333-3333-4333-8333-333333333306",
    title: "2 Kişilik Balık Menü",
    sale_price: 900,
    summer_reference_price: 2000,
    usage_count: 1,
    expires_at: new Date(now() + 40 * DAYS).toISOString(),
    purchasable: false,
    isDemo: true,
    business: {
      name: "Marmaris Balık Sofrası",
      slug: "marmaris-balik-sofrasi",
      district: "Marina",
      city: "Marmaris",
      category: "restoran",
      cover_url: "https://images.unsplash.com/photo-1544025162-d76694265947?w=1200&q=80",
    },
  },
];

export const DEMO_FLASH_DEALS: FlashDeal[] = [
  {
    id: "44444444-4444-4444-8444-444444444401",
    offer_text: "Bu akşam 2 al 1 öde — filtre kahve",
    starts_at: new Date(now() - 30 * 60 * 1000).toISOString(),
    ends_at: new Date(now() + 5 * HOURS).toISOString(),
    total_quota: 20,
    remaining_quota: 14,
    reserved_by_me: false,
    my_confirmation_code: null,
    isDemo: true,
    business: {
      name: "Liman Kafe",
      slug: "liman-kafe-bodrum",
      district: "Gümbet",
      city: "Bodrum",
      category: "kafe",
      cover_url: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=1200&q=80",
    },
  },
  {
    id: "44444444-4444-4444-8444-444444444402",
    offer_text: "Bu akşam şezlong %50 indirimli",
    starts_at: new Date(now() - 60 * 60 * 1000).toISOString(),
    ends_at: new Date(now() + 4 * HOURS).toISOString(),
    total_quota: 15,
    remaining_quota: 6,
    reserved_by_me: false,
    my_confirmation_code: null,
    isDemo: true,
    business: {
      name: "Çeşme Mavi Beach Club",
      slug: "cesme-mavi-beach-club",
      district: "Çeşme Merkez",
      city: "Çeşme",
      category: "beach_club",
      cover_url: "https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1200&q=80",
    },
  },
];

export const DEMO_EVENTS: EventListItem[] = [
  {
    id: "55555555-5555-4555-8555-555555555501",
    title: "Canlı Müzik Akşamı",
    event_at: new Date(now() + 3 * DAYS).toISOString(),
    image_url: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1200&q=80",
    is_paid: true,
    ticket_price: 250,
    capacity: 60,
    ticket_count: 0,
    isDemo: true,
    business: { name: "Rüzgar Sofrası", slug: "ruzgar-sofrasi-yalikavak" },
  },
  {
    id: "55555555-5555-4555-8555-555555555502",
    title: "Gün Batımı Sörf Turu",
    event_at: new Date(now() + 5 * DAYS).toISOString(),
    image_url: "https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=1200&q=80",
    is_paid: true,
    ticket_price: 400,
    capacity: 20,
    ticket_count: 0,
    isDemo: true,
    business: { name: "Alaçatı Sörf Okulu", slug: "alacati-sorf-okulu" },
  },
  {
    id: "55555555-5555-4555-8555-555555555503",
    title: "Marina Balık Pazarı",
    event_at: new Date(now() + 7 * DAYS).toISOString(),
    image_url: "https://images.unsplash.com/photo-1544025162-d76694265947?w=1200&q=80",
    is_paid: false,
    ticket_price: null,
    capacity: 150,
    ticket_count: 0,
    isDemo: true,
    business: { name: "Marmaris Balık Sofrası", slug: "marmaris-balik-sofrasi" },
  },
];

const DEMO_BUSINESS_ID: Record<string, string> = {
  "liman-kafe-bodrum": "22222222-2222-4222-8222-222222222201",
  "ruzgar-sofrasi-yalikavak": "22222222-2222-4222-8222-222222222202",
  "alacati-sorf-okulu": "22222222-2222-4222-8222-222222222203",
  "tas-konak-alacati": "22222222-2222-4222-8222-222222222204",
  "cesme-mavi-beach-club": "22222222-2222-4222-8222-222222222205",
  "marmaris-balik-sofrasi": "22222222-2222-4222-8222-222222222206",
};

const DEMO_PACKAGE_DESCRIPTIONS: Record<string, string> = {
  "33333333-3333-4333-8333-333333333301": "Filtre kahve veya espresso bazlı 5 içecek hakkı.",
  "33333333-3333-4333-8333-333333333302": "2 kişilik ana yemek + meze tabağı.",
  "33333333-3333-4333-8333-333333333303": "Ekipman dahil, eğitmen eşliğinde 3 ders.",
  "33333333-3333-4333-8333-333333333304": "Kahvaltı dahil çift kişilik oda, 1 gece.",
  "33333333-3333-4333-8333-333333333305": "2 şezlong + karşılama içeceği.",
  "33333333-3333-4333-8333-333333333306": "Meze + günün balığı + tatlı.",
};

export const DEMO_PACKAGE_DETAILS: PackageDetail[] = DEMO_PACKAGES.map((p) => ({
  id: p.id,
  title: p.title,
  description: DEMO_PACKAGE_DESCRIPTIONS[p.id] ?? null,
  sale_price: p.sale_price,
  summer_reference_price: p.summer_reference_price,
  normal_value: null,
  usage_count: p.usage_count,
  expires_at: p.expires_at,
  purchasable: false,
  isDemo: true,
  business: {
    id: DEMO_BUSINESS_ID[p.business.slug] ?? p.id,
    name: p.business.name,
    slug: p.business.slug,
    district: p.business.district,
    city: p.business.city,
    category: p.business.category,
    cover_url: p.business.cover_url,
  },
}));

export function demoPackageDetail(id: string): PackageDetail | null {
  return DEMO_PACKAGE_DETAILS.find((p) => p.id === id) ?? null;
}

// Deliberately does NOT fall back to other cities' demo items — showing a
// Bodrum business while browsing Fethiye would look like a real location
// bug, not a "just a demo" quirk. No match just means the real empty state
// shows, same as it would with real (still-empty) data.
export function demoPackagesForCity(city?: string): DiscoverPackage[] {
  if (!city) return DEMO_PACKAGES;
  return DEMO_PACKAGES.filter((p) => p.business.city === city);
}

export function demoFlashDealsForCity(city?: string): FlashDeal[] {
  if (!city) return DEMO_FLASH_DEALS;
  const inCity = DEMO_FLASH_DEALS.filter((d) => d.business.city === city);
  return inCity.length > 0 ? inCity : [];
}

const DEMO_EVENT_META: Record<string, { description: string; district: string }> = {
  "55555555-5555-4555-8555-555555555501": {
    description: "Akustik canlı müzik eşliğinde akşam yemeği.",
    district: "Yalıkavak",
  },
  "55555555-5555-4555-8555-555555555502": {
    description: "Deneyimli sörfçüler için gün batımı turu.",
    district: "Alaçatı",
  },
  "55555555-5555-4555-8555-555555555503": {
    description: "Yerel üreticilerle açık hava balık ve deniz ürünleri pazarı.",
    district: "Marina",
  },
};

export const DEMO_EVENT_DETAILS: EventDetail[] = DEMO_EVENTS.map((e) => ({
  ...e,
  description: DEMO_EVENT_META[e.id]?.description ?? null,
  business_district: DEMO_EVENT_META[e.id]?.district ?? null,
}));

export function demoEventDetail(id: string): EventDetail | null {
  return DEMO_EVENT_DETAILS.find((e) => e.id === id) ?? null;
}

const DEMO_BUSINESS_CITY: Record<string, string> = {
  "liman-kafe-bodrum": "Bodrum",
  "ruzgar-sofrasi-yalikavak": "Bodrum",
  "alacati-sorf-okulu": "Alaçatı",
  "tas-konak-alacati": "Alaçatı",
  "cesme-mavi-beach-club": "Çeşme",
  "marmaris-balik-sofrasi": "Marmaris",
};

export function demoEventsForCity(city?: string): EventListItem[] {
  if (!city) return DEMO_EVENTS;
  return DEMO_EVENTS.filter((e) => DEMO_BUSINESS_CITY[e.business.slug] === city);
}
