export interface Town {
  slug: string;
  label: string;
  /** Correctly vowel-harmonized possessive form, e.g. "Bodrum'un", "Alaçatı'nın" — for copy like "{possessive} işletmelerini keşfet". */
  possessive: string;
  /** Full-bleed homepage hero background. */
  heroImage: string;
  /** Short, evocative hero line — sells the destination before the discounts. */
  heroTagline: string;
  /**
   * A single destination accent used ONLY for small, contained details (the
   * hero search button, a couple of chips) — never the app's primary teal,
   * never applied globally. Picked loosely per the brief's examples
   * (Bodrum→turquoise, Kaş→deep blue, Alaçatı→warm beige, Ayvalık→olive,
   * Bozcaada→lavender, Datça→earthy).
   */
  accent: string;
}

// Label is the canonical value — it must match the `city` text stored on
// `businesses` rows exactly, since queries filter on it directly.
// Hero photos are Unsplash stock imagery: wide, bright coastal atmosphere
// shots (sea/sky/marina/white architecture) rather than landmark close-ups,
// each individually searched and visually verified — not guessed. Swap the
// url here if a better real photo turns up later.
export const TOWNS: Town[] = [
  {
    slug: "bodrum",
    label: "Bodrum",
    possessive: "Bodrum'un",
    heroImage: "https://images.unsplash.com/photo-1767884161153-067d6274309e?w=2600&q=80",
    heroTagline: "Yelkenli dolu bir koy, badem çiçekleri, masmavi bir liman kasabası",
    accent: "#14919B",
  },
  {
    slug: "alacati",
    label: "Alaçatı",
    possessive: "Alaçatı'nın",
    heroImage: "https://images.unsplash.com/photo-1600602267758-c62a63fa8f14?w=2600&q=80",
    heroTagline: "Taş sokaklar, tarihi yel değirmenleri, esintili akşamlar",
    accent: "#C08552",
  },
  {
    slug: "cesme",
    label: "Çeşme",
    possessive: "Çeşme'nin",
    heroImage: "https://images.unsplash.com/photo-1636377688406-e0d0108eb882?w=2600&q=80",
    heroTagline: "Berrak sular, ince kumsallar, sonsuz yaz hissi",
    accent: "#2E86AB",
  },
  {
    slug: "marmaris",
    label: "Marmaris",
    possessive: "Marmaris'in",
    heroImage: "https://images.unsplash.com/photo-1651946320361-4a190e1e5378?w=2600&q=80",
    heroTagline: "Çam kokulu koylar, canlı bir marina",
    accent: "#3F7D5C",
  },
  {
    slug: "fethiye",
    label: "Fethiye",
    possessive: "Fethiye'nin",
    heroImage: "https://images.unsplash.com/photo-1744574691828-4a35d5a48056?w=2400&q=80",
    heroTagline: "Turkuaz bir lagün, gökyüzünde süzülen yamaç paraşütleri",
    accent: "#4A90C4",
  },
  {
    slug: "kas",
    label: "Kaş",
    possessive: "Kaş'ın",
    heroImage: "https://images.unsplash.com/photo-1662486715467-dc46b8a91c1d?w=2600&q=80",
    heroTagline: "Kayalık koylar, billur gibi berrak bir deniz",
    accent: "#1B4F72",
  },
  {
    slug: "datca",
    label: "Datça",
    possessive: "Datça'nın",
    heroImage: "https://images.unsplash.com/photo-1600194795031-e8c60926db4f?w=2600&q=80",
    heroTagline: "Badem ve zeytin ağaçları arasında uzanan turkuaz bir yarımada",
    accent: "#A9744F",
  },
  {
    slug: "bozcaada",
    label: "Bozcaada",
    possessive: "Bozcaada'nın",
    heroImage: "https://images.unsplash.com/photo-1571205350653-8e908c22c161?w=2600&q=80",
    heroTagline: "Bağlar ve yel değirmenleri arasında, rüzgarlı bir ada sessizliği",
    accent: "#8E7CC3",
  },
  {
    slug: "ayvalik",
    label: "Ayvalık",
    possessive: "Ayvalık'ın",
    heroImage: "https://images.unsplash.com/photo-1601883316566-a7ba696adaa6?w=2600&q=80",
    heroTagline: "Zeytinlikler, taş konaklar, Ege'nin sakin yüzü",
    accent: "#6B7B3A",
  },
  {
    slug: "cunda",
    label: "Cunda",
    possessive: "Cunda'nın",
    heroImage: "https://images.unsplash.com/photo-1657975333154-5f5f723e23bb?w=2400&q=80",
    heroTagline: "Rum mimarisi, balıkçı tekneleri, sakin bir ada havası",
    accent: "#3E8E8A",
  },
  {
    slug: "gocek",
    label: "Göcek",
    possessive: "Göcek'in",
    heroImage: "https://images.unsplash.com/photo-1569660073216-1a6762baad6a?w=2400&q=80",
    heroTagline: "Çam ormanlarıyla çevrili, sakin bir koylar cenneti",
    accent: "#2C6E8E",
  },
  {
    slug: "akyaka",
    label: "Akyaka",
    possessive: "Akyaka'nın",
    heroImage: "https://images.unsplash.com/photo-1697494894688-912e4a2a4b0c?w=2400&q=80",
    heroTagline: "Yeşil bir vadide, sazlıklar arasında akan bir nehir",
    accent: "#4F8A6D",
  },
];

export const DEFAULT_TOWN = TOWNS[0];
export const CITY_COOKIE = "locally-city";

export function isKnownTown(city: string): boolean {
  return TOWNS.some((t) => t.label === city);
}
