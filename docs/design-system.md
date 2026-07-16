# Locally design system — "sıcak kış sahili" (warm winter coast)

This document supersedes the previous **Liman** spec in this file (cold
ink/fog, dark-as-default ground). That direction is dropped. **Nothing from
the Liman palette, type pairing, or "cold ground / rationed warmth" thesis
carries forward.** Do not mix it with what's below.

---

## 0. Brand philosophy

Locally should feel like a coastal town that's still alive in winter — not a
tech product. Local, trustworthy, warm, a little nostalgic, but built with
modern craft. The ground is warm cream, not dark. Petrol ink and turquoise
carry the brand's confidence; warm orange is saved for the moments that
matter (today's price, flash urgency, the main call to action).

**Anti-patterns — do not do these:**
- Dark backgrounds anywhere outside the one deliberate "Bu Akşam" band.
- Pure black or pure gray for any neutral — every neutral is warm-tinted
  (sand/sepia), never `#000` or cool `slate`/`gray`.
- Glassmorphism, neon glow, purple-pink gradients, hollow decorative icons.
- Heavy drop shadows for depth — depth comes from ground-tone contrast and
  1px warm hairlines.
- Identical "heading + three cards + list" template on every page. Landing
  and showcase surfaces are editorial and asymmetric; the panel is calm and
  gridded, but never a copy-pasted layout from another screen.

---

## 1. Typography

Two-voice system:

| Role | Typeface | Use |
|---|---|---|
| **Display / editorial** | **Fraunces** (variable, incl. italic, `opsz`/`SOFT` axes) | Hero headlines, section openers, big prices as a *statement*, pull quotes. Characterful, slightly retro serif — the magazine voice. |
| **UI / body** | **Manrope** | Navigation, body copy, forms, buttons, dense UI, numerals in cards. Clean modern grotesk. Both fonts load via `next/font/google` in `app/layout.tsx` (`--font-display`, `--font-sans`) and are verified for full Turkish glyph coverage (ş ğ ı İ ö ü ç). |

Hero headlines run one to two steps bigger than instinct feels safe, tight
line-height, serif, `text-wrap: balance`. Prices and counters are always
Manrope, bold, large — never apologetic. Uppercase eyebrow labels always
carry `tracking-wide` or wider — never uppercase without added letter-spacing.

---

## 2. Color system

All tokens are consumed as CSS vars (`app/globals.css`) or Tailwind color
scales (`tailwind.config.ts`). Never hardcode a raw hex in a component.

| Token | Hex (key step) | Role |
|---|---|---|
| `--background` / `sand-50` | `#fbf6ec` | App ground — warm cream/ivory, never white, never dark |
| `--card` | `#fffdf8` | Card/paper surface — barely-off-white, warm |
| `ink` (500 `#0b3d4c`, alias `dark`) | `#0b3d4c` | Petrol — headlines, body text, "ink" blocks (the one deliberate dark surface: the Bu Akşam band, stamps, panel sidebar) |
| `primary` (turquoise, 500 `#14a3b8`) | `#14a3b8` | Main interactive color: links, buttons, active states, focus ring |
| `accent` (warm orange, 400 `#ffb35c`) | `#ffb35c` | Rationed: today's price, flash-deal urgency, hero CTAs only — never a background wash |
| `sand` (50–950) | `#fbf6ec`…`#2c2415` | Warm kum/bej — section backgrounds, ticket stubs, dividing bands |
| `primary-50`/`primary-100` | `#eefbfc` / `#d5f2f5` | Turquoise wash — pale tinted section backgrounds |
| `sepia` (50–950) | `#f8f5f0`…`#1c1913` | Warm neutral scale — muted text, hairline borders. Replaces gray/slate entirely |
| `tile` (50–900, "tuğla") | key `#b8492a` | Warm brick-red — errors, destructive actions. Never a raw/cool red |

No pure black, no pure white, no cool gray anywhere in the app.

### "Evening" mode
The theme toggle stays, reskinned onto the same brand rather than a generic
dark UI: background `ink-950 #062028`, card `ink-900 #0b3d4c`, text
`sand-50`, ring shifts to `accent-400` (lamp glow). This is the *only* place
outside the Bu Akşam band that a fully dark surface is acceptable.

---

## 3. Signature motifs (must recur across the app)

1. **Ticket motif** — package cards, coupons, ticket/QR views are not plain
   rectangles. Use `<TicketCard>` (`components/ui/ticket-card.tsx`): a
   perforated dashed seam with punched circular notches (`.ticket-perforation`
   utility in `globals.css`) separates the main body from a stub section.
   The product is a right/ticket — its shape should say so.
2. **Stamp motif** — verification, "used", "confirmed" states use
   `<Stamp>` (`components/ui/stamp.tsx`): a rotated (~-7°), double-ringed
   ink seal (`.stamp` utility), not a flat colored badge.
3. **Hand-drawn accent** — section headings use `<Scribble>`
   (`components/ui/scribble.tsx`), a short brush-stroke SVG underline
   instead of a straight rule. Small, but load-bearing for warmth.

These three motifs must be visible in at least: showcase/discover cards,
package detail, "paketlerim" (my tickets), and confirmation screens.

---

## 4. Spacing, radius, elevation

- Spacing: 4px base unit. Section-to-section gaps are generous (64–160px) —
  under-spacing is the fastest way back to "generic SaaS."
- Radius: consistent but not extreme — `sm 10px · md 14px · lg 18px ·
  xl 24px · 2xl 32px` (`--radius-*` vars). No sharp corners, no pill-everything.
- Elevation: shadows are used only for true overlays (menus, modals,
  dropdowns) at the reduced warm-tinted values in `tailwind.config.ts`
  (`shadow-sm/md/lg/xl`, all `rgb(11 61 76 / …)`). Resting cards use a 1px
  warm border (`border-border`) and a ground-tone shift (`bg-card` on
  `bg-background`), not a shadow.

---

## 5. Layout principles

- Landing / discover / showcase surfaces are **editorial**: one full-width
  headline moment, then asymmetric content (one large + two small, or
  offset/staggered cards) — never a uniform three-up grid everywhere.
- **"Bu Akşam" is the one deliberate dark band**: full-width `ink-900`
  section sitting inside the cream page, orange countdown living inside it.
  Because it's the only dark block on the page, it should pull the eye
  immediately.
- Business panel: calmer, denser, fewer motifs, strict grid — a workspace in
  the same brand family, not a storefront. Sidebar may use the ink/petrol
  surface; content area stays on the warm cream ground.
- Container: content max `72rem`, editorial reading measure `~65ch`.

---

## 6. States

- Hover: subtle lift (`-translate-y-0.5` at most) + tone-darken, not a hard
  color swap.
- Loading skeletons: shimmer in sand/cream tones (`bg-muted` + `.shimmer`),
  never gray.
- Empty states: warm copy + a small motif illustration (ticket/stamp line
  art), never a cold "no data" message.
- Errors/warnings: `tile` (brick) tones, never raw red; urgency countdowns
  drift from `accent` (orange) toward `tile` (brick) as time runs out.
- Focus ring: always `--ring` (turquoise in day mode, orange in evening
  mode), 2px, visible — never suppressed.

---

## 7. Implementation notes

- Fonts load in `app/layout.tsx` via `next/font/google` (Fraunces + Manrope).
- Tokens live centrally in `tailwind.config.ts` (color ramps, radius,
  shadow) and `app/globals.css` (CSS vars, `.ticket-perforation`, `.stamp`
  utilities). Every component consumes these — no page may define its own
  one-off palette.
- `ink` is the new name for the petrol ramp; `dark` is kept as an identical
  alias for existing call-sites. The old cool-gray `ink-*` scale (phase 1)
  is renamed `sepia`.
