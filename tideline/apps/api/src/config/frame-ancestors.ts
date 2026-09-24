// Locally embeds Tideline in an iframe. Which parent origins may do that is set
// with ALLOWED_FRAME_ANCESTORS (comma-separated) so a new production domain only
// needs an env change. Unset falls back to the local Locally/Tideline dev origins.
export const DEFAULT_FRAME_ANCESTORS = ["http://localhost:3001", "http://localhost:5173"];

export function resolveFrameAncestors(raw: string | undefined): { origins: string[]; isDefault: boolean } {
  const origins = (raw ?? "")
    .split(",")
    .map((x) => x.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  if (origins.length === 0) return { origins: DEFAULT_FRAME_ANCESTORS, isDefault: true };
  for (const origin of origins) {
    if (!URL.canParse(origin) || new URL(origin).origin !== origin)
      throw new Error(`ALLOWED_FRAME_ANCESTORS entry must be a bare origin: ${origin}`);
  }
  return { origins, isDefault: false };
}

export function frameAncestorsHeader(origins: string[]): string {
  return `frame-ancestors 'self' ${origins.join(" ")}`;
}
