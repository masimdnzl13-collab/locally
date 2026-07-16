# Locally design system — local discovery marketplace

This document replaces every prior design spec in this repo (the "Liman"
cold-harbor spec and the "sıcak kış sahili" warm-coast spec). Neither
carries forward. **Delete on sight**: `TicketCard`, `Stamp`, `Scribble`,
any `ink-*`/`sand-*`/`sepia-*`/`tile-*`/`accent-*` Tailwind color usage,
Fraunces, Manrope. None of it is reused.

---

## 0. What Locally is

Locally is a **local discovery marketplace**: businesses post seasonal
campaigns (discounted packages, flash deals, ticketed events), users
browse and buy. It is not a tourism site, not a hotel site, not an
agency brochure. The reference points are Groupon, Yelp, DoorDash, Airbnb
Experiences, Apple/Google Maps — real product, content-first, scannable,
trustworthy. A first-time visitor should understand "local deals
marketplace" within 3 seconds, from the interface alone.

**Anti-patterns:**
- A big empty hero with a single headline and nothing to browse below the
  fold. Real inventory (cards, deals, categories) appears immediately.
- Marketing buzzwords, giant illustrations, decorative gradients.
- Any fabricated data: no fake star ratings, no fake review counts, no
  fake "open now" status, no invented categories. If the backend doesn't
  have it, the UI doesn't claim it (see §8).

---

## 1. Color system

CSS vars in `app/globals.css` are **"R G B" triplets**, consumed via
`rgb(var(--x) / <alpha-value>)` in `tailwind.config.ts` so opacity
modifiers (`bg-background/80`) work correctly — never revert to plain
hex strings in a CSS var.

| Token | Hex (key step) | Role |
|---|---|---|
| `--background` | `#FAFAF9` | App ground — warm white, not stark `#fff`, not cream |
| `--card` | `#FFFFFF` | Card/surface — clean white, sits just above the ground |
| `--muted` | `#F4F3F1` | Sunken section backgrounds, table stripes |
| `--border` | `#E8E6E1` | 1px hairlines everywhere |
| `navy` (900 `#101B29`) | typography, icons, nav/footer/panel-sidebar dark surfaces |
| `teal` (500 `#1D8A8B`) | **the** interactive color — links, active states, primary buttons. Subtle, desaturated, never neon turquoise |
| `discount` (500 `#DD6B0F`) | orange, **rationed**: discount badges, "save ₺X" amounts only |
| `success` (500 `#189A57`) | green, **rationed**: confirmed purchase, successful deal states only |
| `danger` (500 `#C1432A`) | errors/destructive actions |
| `stone` (50–950) | warm-neutral scale — replaces gray/slate/zinc entirely for text and borders |

No pure black, no default Tailwind gray/slate/zinc, no purple/pink
gradients, no glassmorphism, no neon glow.

---

## 2. Typography

| Role | Typeface | Use |
|---|---|---|
| **UI / body / everything** | **Inter** (`--font-sans`) | Navigation, body copy, forms, buttons, card content, numbers/prices. The default for ~95% of the interface. |
| **Emphasis only** | **Newsreader** italic (`--font-serif`) | Sparingly: a hero headline, a section opener, a large "you saved ₺X" moment. Not a heading font used everywhere — if more than one or two elements per screen use it, that's too many. |

Large, clear hierarchy; comfortable measure; no oversized paragraphs.
Prices are bold Inter, tabular where they're compared (`tabular-nums`),
never in the serif.

---

## 3. Spacing & radius

- 8pt spacing system — Tailwind's default scale already aligns (`p-2`=8,
  `p-4`=16, `p-6`=24, `p-8`=32...). Use it consistently; no arbitrary
  odd-pixel padding.
- Radius is role-based, not uniform:
  - Cards: `rounded-lg` (20px, `--radius-lg`)
  - Buttons: `rounded-md` (14px, `--radius-md`)
  - Inputs: `rounded-input` (16px, `--radius-input`)
  - Badges/pills/avatars: `rounded-full`
  - Large sheets/modals/hero panels: `rounded-xl` (24px)

## 4. Elevation

Shadows are real but restrained — `shadow-card` for resting cards
(barely-there), `shadow-card-hover` on hover/focus (a clear but not
dramatic lift), `shadow-md/lg/xl` for menus/popovers/modals. Never a
default Tailwind gray shadow — all shadow tokens in
`tailwind.config.ts` are navy-tinted (`rgb(16 27 41 / …)`).

---

## 5. Navigation

Full rewrite (`components/nav-bar.tsx`), desktop layout:

```
[Logo]  [Search bar]  [Location selector]     Keşfet  Kampanyalar     ♡ 🔔  [Profile]  [İşletme Paneli CTA]
```

- Sticky. Transparent over the homepage hero, solid `bg-background/95`
  + `backdrop-blur` + `shadow-sm` once scrolled past the hero (see
  `useScrollSolid`-style pattern — track scrollY, toggle a class).
- Active nav link gets an animated underline (teal), not a filled pill.
- Business-panel CTA is a quiet outlined/ghost button, not a loud
  competing CTA against the primary teal actions.
- Mobile: logo + search icon + menu; category/search expands into a
  full-width sheet, not cramped into the header.

## 6. Cards

One card component family, variant-driven — **do not build separate
"BusinessCard" and "CampaignCard" components that duplicate the same
image/badge/price layout**. `components/ui/deal-card.tsx` takes a
`variant="compact" | "featured"` prop:
- Image-first (aspect-[4/3] compact, aspect-[16/10] featured), category
  badge and discount badge overlaid on the image, save (♡) button
  top-right.
- Body: category label, business name + district, title, price row
  (struck-through reference price + bold current price + "%X" savings
  in `discount` orange).
- Hover: `shadow-card` → `shadow-card-hover` + slight `-translate-y-1`,
  image scales slightly. GPU-accelerated (`transform`/`opacity` only),
  150–200ms, no bounce.
- **Do not add rating stars, review counts, "open now" status, or a
  price-level (`$$$`) indicator — the schema has none of this data.**
  If it's not real, it's not on the card.

## 7. Sections ("shelves")

Homepage/discover pages are built from a reusable
`components/ui/shelf.tsx`: heading + optional "Tümünü gör" link + a
responsive grid (or horizontal scroll on mobile, `no-scrollbar`
utility). Every shelf must be backed by a real query — see §8 for the
homepage's actual data mapping.

---

## 8. Data reality — what's real vs. what had to be adapted

The schema (see `lib/types.ts`, `lib/*/queries.ts`) has: packages
(discounted campaigns), flash deals (time-boxed tonight-only offers),
events (ticketed), businesses with **6** categories (`restoran`, `kafe`,
`otel`, `beach_club`, `aktivite`, `diger`), and city/district text
fields. It does **not** have: ratings/reviews, business hours,
geolocation-based distance (lat/lng columns exist but nothing computes
distance), favorites, notifications, or curated "collections."

Adaptations made, not fabrications:
- "Nearby businesses" → **city-scoped**, not geo-distance (no real
  distance data exists). Label accordingly, e.g. "Şehrindeki fırsatlar."
- "Spa," "Bakery," "Bar," "Museum," etc. category shelves → **not
  built**; the category enum only has 6 values. Category shelves are
  Restoran / Kafe / Otel / Beach Club / Aktivite only.
- "Today's Deals" → flash deals (`getActiveFlashDeals`), which are
  literally time-boxed same-day offers — the closest real match.
- "Recently Added" → packages ordered by `created_at desc` (already the
  default query order).
- "Collections" → not a real curated concept; folded into the
  category-based shelves instead of inventing fake curation.
- Favorites (♡) → implemented for real via `lib/favorites` (a small
  `useFavorites` localStorage hook), not backed by Supabase. It works,
  it's just device-local rather than account-synced — that's the honest
  scope of a redesign task that shouldn't silently add a new DB table.
- Notifications (🔔) → no in-app notification feed exists in the
  backend. The icon is present per the requested nav layout but opens an
  honest empty state, not fabricated notification content.

---

## 9. Motion

Framer Motion, small durations (150–300ms), `cubic-bezier(0.16, 1, 0.3,
1)` easing, GPU-accelerated properties only. Reduced motion is CSS-first
per the existing `[data-motion-reveal]` pattern in `globals.css` — never
branch initial render output on `useReducedMotion()`.

## 10. Accessibility

4.5:1 minimum text contrast, visible focus rings (`--ring`, teal),
44×44px touch targets, semantic HTML, full keyboard operability on every
custom control (search, category chips, save button).
