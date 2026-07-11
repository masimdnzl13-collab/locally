const TR_MAP: Record<string, string> = {
  ç: "c",
  ğ: "g",
  ı: "i",
  ö: "o",
  ş: "s",
  ü: "u",
  Ç: "c",
  Ğ: "g",
  İ: "i",
  Ö: "o",
  Ş: "s",
  Ü: "u",
};

export function slugify(input: string): string {
  const replaced = input
    .split("")
    .map((ch) => TR_MAP[ch] ?? ch)
    .join("");

  return replaced
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function uniqueSlug(name: string): string {
  const base = slugify(name) || "isletme";
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base}-${suffix}`;
}
