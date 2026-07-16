export interface Town {
  slug: string;
  label: string;
  /** Correctly vowel-harmonized possessive form, e.g. "Bodrum'un", "Alaçatı'nın" — for copy like "{possessive} işletmelerini keşfet". */
  possessive: string;
}

// Label is the canonical value — it must match the `city` text stored on
// `businesses` rows exactly, since queries filter on it directly.
export const TOWNS: Town[] = [
  { slug: "bodrum", label: "Bodrum", possessive: "Bodrum'un" },
  { slug: "alacati", label: "Alaçatı", possessive: "Alaçatı'nın" },
  { slug: "cesme", label: "Çeşme", possessive: "Çeşme'nin" },
  { slug: "marmaris", label: "Marmaris", possessive: "Marmaris'in" },
  { slug: "fethiye", label: "Fethiye", possessive: "Fethiye'nin" },
  { slug: "kas", label: "Kaş", possessive: "Kaş'ın" },
  { slug: "datca", label: "Datça", possessive: "Datça'nın" },
  { slug: "bozcaada", label: "Bozcaada", possessive: "Bozcaada'nın" },
  { slug: "ayvalik", label: "Ayvalık", possessive: "Ayvalık'ın" },
  { slug: "cunda", label: "Cunda", possessive: "Cunda'nın" },
  { slug: "gocek", label: "Göcek", possessive: "Göcek'in" },
  { slug: "akyaka", label: "Akyaka", possessive: "Akyaka'nın" },
];

export const DEFAULT_TOWN = TOWNS[0];
export const CITY_COOKIE = "locally-city";

export function isKnownTown(city: string): boolean {
  return TOWNS.some((t) => t.label === city);
}
