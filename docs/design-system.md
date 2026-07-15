# Liman — the Locally design system

**Liman** (Turkish: *harbor*) is Locally's design language. Named for the place
a coastal town actually lives in winter — not the beach, the harbor: boats
pulled up, cafés lit, people still out at dusk. That is the emotional register
every screen should hit.

This document is the source of truth for phase-2 implementation. It
supersedes the phase-1 tokens (`tailwind.config.ts` / `app/globals.css` as of
the previous commit) — nothing from the old palette (bright SaaS turquoise,
Fraunces + Plus Jakarta Sans, cool near-black dark mode) carries forward.
**Do not mix old and new tokens in the same component.**

---

## 0. Brand philosophy

Locally's pitch is *"kasabanın kışı da güzel"* — the town's winter is
beautiful too. That is a specific emotional idea, not generic warmth: **cold
outside, warm inside.** The sea in December is grey-teal and moody. A café
window glowing amber across a wet cobblestone street is precious *because*
of that cold. The design language is built on that contrast, not on
blanket "cozy minimalism."

Concretely, this means:
- The dominant ground is **cool** — deep harbor-ink, pale winter fog. Not
  cream, not beige.
- Warmth is **rationed**, not ambient. Two accent hues (lamplight amber,
  ember coral) appear at moments that deserve them — a live deal, a price,
  a badge — never as a background wash.
- Confidence over cuteness. No travel clichés (sun emoji, palm trees,
  postcard gradients), no corporate SaaS coldness either.

**The recognizability test:** a screenshot with the logo cropped out should
still read as Locally — because of the ink/fog contrast, the Newsreader
display italic, and the amber "lamplight" moments, not because of a logo.

**Anti-patterns — do not do these:**
- Warm cream background + terracotta accent + generic serif (the default
  "AI warm minimalism" look). Our ground is cool; warmth is a rare accent.
- Flat, identical card components everywhere. Cards have *personalities*
  by purpose (§7.2).
- Cold-blue focus rings, gray drop shadows, emoji as icons or section
  markers.
- `rounded-2xl` applied uniformly. Radius communicates context (§4).
- Decorative motion. Every animation in §6 exists to communicate state.

---

## 1. Typography

Three roles, deliberately not matched to a single "safe" grotesk:

| Role | Typeface | Source | Use |
|---|---|---|---|
| **Display / Editorial** | **Newsreader** (variable, incl. italic) | Google Fonts | Hero headlines, storytelling moments, section openers, pull quotes. Editorial because Locally is literally publishing local businesses' stories — it should read like a well-set town gazette, not app copy. |
| **UI / Body** | **Instrument Sans** | Google Fonts | Navigation, body copy, forms, buttons, dense UI. Humanist grotesk, warm without being rounded-and-cute; still uncommon enough (2024 release) to avoid the Inter/Manrope "default startup" read. |
| **Utility / Numeric** | **IBM Plex Mono** | Google Fonts | Prices in tables, ticket/QR codes, timestamps, order refs. Used sparingly — it's the "receipt" texture, not a UI voice. |

Fallback stack if Turkish glyph coverage (ş ğ ı İ ö ü ç) needs verification at
implementation time: Newsreader → `Georgia, serif`; Instrument Sans →
`Hanken Grotesk` (Google Fonts, confirmed full latin-ext) → `system-ui`.

**Scale** (rem, 16px root):

| Token | Size | Line-height | Tracking | Typical use |
|---|---|---|---|---|
| `text-xs` | 0.75 (12px) | 1.4 | +0.02em | mono labels, captions |
| `text-sm` | 0.875 (14px) | 1.5 | 0 | secondary UI |
| `text-base` | 1 (16px) | 1.6 | 0 | body |
| `text-md` | 1.125 (18px) | 1.6 | 0 | lead paragraph |
| `text-lg` | 1.375 (22px) | 1.35 | -0.01em | card/subsection titles |
| `text-xl` | 1.75 (28px) | 1.2 | -0.01em | section headings |
| `text-2xl` | 2.25 (36px) | 1.15 | -0.015em | page headings |
| `text-3xl` | 3 (48px) | 1.08 | -0.02em | hero, mobile |
| `text-4xl` | 4 (64px) | 1.05 | -0.02em | hero, desktop |
| `text-5xl` | 5.5 (88px) | 1.02 | -0.025em | landing hero, desktop only |

Rules: headings get `text-wrap: balance`. Uppercase eyebrow labels always
carry the `+tracking` value above — never uppercase without added
letter-spacing. Body copy max measure ~65ch.

---

## 2. Color system

Five named brand hues (light/dark both first-class, not inverted
mechanically). All pairings below are checked for ≥4.5:1 text contrast
minimum, ≥7:1 where the token is marked **AAA**.

| Name | Role | Hex | Notes |
|---|---|---|---|
| **Ink** | dominant dark ground | `#0E2323` | teal-black, "the sea at dusk" — not neutral black |
| **Fog** | dominant light ground | `#EDF1EF` | cool pale stone — not cream |
| **Harbor** | primary brand / interactive | `#1F7A72` | deep confident teal, refined down from bright SaaS turquoise |
| **Lamplight** | accent — warmth, price, live state | `#E3A542` | rationed: badges, active prices, live pulse only |
| **Ember** | secondary accent — rare delight | `#C85A42` | muted brick-coral, collectible badges, special CTAs only |

### Full ramps (50–950, both brand hues + neutral)

```
harbor:    50 #EAF5F3  100 #CFE9E5  200 #9FD2CA  300 #6BB6AB  400 #3F978C
           500 #1F7A72  600 #17615C  700 #144E4B  800 #123F3D  900 #103331
           950 #0A2120

lamplight: 50 #FDF6E9  100 #FAE7C4  200 #F4CE8B  300 #ECB158  400 #E89934
           500 #E3A542* 600 #C2841F  700 #9C6819  800 #7C5419  900 #66451A
           *500 tuned lighter than 600 deliberately — this is the "glow" step
           950 #3A260D

ember:     50 #FCEEEA  100 #F7D5CB  200 #EDAE9B  300 #E08669  400 #D26E4E
           500 #C85A42  600 #A8452F  700 #863728  800 #6C2E23  900 #58271F
           950 #301410

ink:       50 #EEF2F1  100 #D3DBD9  200 #A9B8B5  300 #7C918D  400 #566E6A
           500 #3D5450  600 #2B403D  700 #1F332F  800 #172724  900 #0E2323
           950 #081615

fog:       25 #F7F9F8  50 #EDF1EF  100 #DFE6E3  200 #C7D1CD  300 #A8B5B0
           400 #86948F  500 #687673  600 #515D5A  700 #3F4947  800 #2E3634
           900 #212726  950 #171B1A
```

### Semantic (functional — never used as brand accent)

| Token | Light | Dark | Use |
|---|---|---|---|
| success | `#4C7A56` | `#7FB88C` | confirmed booking, payment ok |
| warning | `#B8862E` | `#E3B15C` | capacity almost full, expiring soon |
| danger | `#B2453A` | `#E08276` | failed payment, error state |

### Theme tokens (semantic, what components actually consume)

```css
:root {                              /* light */
  --bg:            fog-25   #F7F9F8;
  --surface:       #FFFFFF;
  --surface-sunken: fog-50  #EDF1EF;
  --border:        fog-200  #C7D1CD;
  --fg:            ink-900  #0E2323;
  --fg-muted:      ink-500  #3D5450;
  --brand:         harbor-500 #1F7A72;
  --brand-strong:  harbor-700 #144E4B;
  --accent-warm:   lamplight-500 #E3A542;
  --accent-ember:  ember-500 #C85A42;
  --ring:          lamplight-500 #E3A542;  /* warm focus ring, never blue */
}
:root[data-theme="dark"] {
  --bg:            ink-950  #081615;
  --surface:       ink-900  #0E2323;
  --surface-sunken: ink-800 #172724;
  --border:        ink-700  #1F332F;
  --fg:            fog-50   #EDF1EF;
  --fg-muted:      fog-400  #86948F;
  --brand:         harbor-400 #3F978C;
  --brand-strong:  harbor-300 #6BB6AB;
  --accent-warm:   lamplight-400 #E89934;
  --accent-ember:  ember-400 #D26E4E;
  --ring:          lamplight-400 #E89934;
}
```

Gradients are named, not decorative: **Dusk** (`harbor-900 → ink-950`, hero
backgrounds), **Lamplight glow** (radial `lamplight-500` at 12% opacity,
behind primary CTAs and active/live cards only).

---

## 3. Spacing system

4px base unit. The philosophy has three tiers, and the tier — not the
number — is what a reviewer should be checking for:

1. **Micro** (4–16px) — inside a component: icon-to-label gap, input
   padding, badge padding.
2. **Element** (24–48px) — between related elements: card sections, form
   field stacks, list rows.
3. **Section** (64–160px) — between page sections. This is the tier that
   carries the brand's "breathing room" — under-spacing here is the single
   most common way a screen ends up feeling like a generic SaaS page.

```
0.25rem (4)  0.5rem (8)  0.75rem (12)  1rem (16)  1.5rem (24)
2rem (32)    3rem (48)   4rem (64)     6rem (96)  8rem (128)  10rem (160)
```

---

## 4. Radius system

Radius communicates *context*, not decoration. Two families:

- **Product / utility** (business panel, dense UI, forms): tighter, quieter.
  `xs 6px` (tags, chips) · `sm 10px` (inputs, buttons in-panel) ·
  `md 14px` (cards, panels).
- **Marketing / emotional** (landing, customer app storefront moments):
  softer, more generous. `lg 20px` (feature cards) · `xl 28px` (hero
  panels, bottom sheets) · `full 999px` (pill CTAs, avatars, badges).

A button's radius is a *signal* of which persona it belongs to — panel
buttons are never pills; marketing CTAs are (almost) always pills.

---

## 5. Elevation — "Ambient Light"

Shadows use warm-tinted ink (`rgba(14,35,35,…)`), never neutral gray, and
read as *low, warm light* (a harbor lamp) rather than a generic drop shadow.

| Level | Use | Value (light) |
|---|---|---|
| resting | default card | `border: 1px solid var(--border)` only, no shadow |
| lifted | hover, active row | `0 2px 8px rgb(14 35 35 / 0.06)` |
| floating | dropdowns, popovers | `0 12px 32px rgb(14 35 35 / 0.10)` |
| overlay | modals, sheets | `0 24px 64px rgb(14 35 35 / 0.18)` |
| **glow-harbor** | primary CTA rest state | `0 8px 24px rgb(31 122 114 / 0.28)` |
| **glow-lamplight** | live/active moment | `0 8px 24px rgb(227 165 66 / 0.35)` |

---

## 6. Motion system — "Tide & Breeze"

Two movement qualities, used deliberately:
- **Tide** — slow, large, settling (page reveals, hero entrances): weighted,
  never bouncy.
- **Breeze** — quick, small, responsive (hover, press, toggles): light,
  immediate.

```
durations:  instant 120ms · quick 220ms · base 360ms · slow 600ms · cinematic 900ms
easings:    settle  cubic-bezier(0.16, 1, 0.3, 1)   — default deceleration (Tide)
            breeze  cubic-bezier(0.4, 0, 0.2, 1)     — standard (Breeze)
springs:    gentle  { stiffness: 260, damping: 30 }  — hover/press feedback
            snap    { stiffness: 420, damping: 34 }  — active indicators, toggles
```

Rules:
- Every animation communicates state (arrival, selection, causality). No
  spin/bounce for decoration.
- **Reduced motion is CSS-first, never a React branch on
  `useReducedMotion()` for initial render output.** Phase 1 shipped a
  hydration-mismatch bug from exactly that pattern (SSR always resolves
  `false`; a real reduced-motion client resolves `true` synchronously on
  first render, so branching `initial`/state on the hook value diverges
  server vs. client). The safe pattern: render motion elements identically
  on server and client, tag them `data-motion-reveal`, and force the
  visible end-state via `@media (prefers-reduced-motion: reduce) { [data-motion-reveal] { opacity: 1 !important; transform: none !important; } }`.
  Only use the JS hook inside `useEffect` (post-mount), never to branch
  render output before mount.

---

## 7. Component rules

### 7.1 Buttons
Two shapes by persona, never mixed on one screen:
- **Marketing/emotional** (landing, storefront CTAs): full pill, confident
  harbor fill or lamplight outline, `glow-harbor`/`glow-lamplight` shadow.
- **Product/utility** (business panel): `radius-sm/md` rounded-rect,
  quieter fills, no glow.
Tactile press: `scale(0.97)` + shadow compresses toward `resting` on press,
spring `gentle`.

### 7.2 Cards have personalities, not one template
- **Showcase card** — packages/events, customer-facing: image-led,
  generous, `radius-lg/xl`, editorial caption treatment (Newsreader for the
  title).
- **Data card** — dashboard stat tiles: tighter, `radius-md`, numerals in
  IBM Plex Mono with `tabular-nums`, optional sparkline.
- **List row** — CRM/customer rows: compact, avatar-forward, hover-lift
  only (`lifted` elevation), never a full card border.
- **Ledger row** — orders/transactions: right-aligned mono numerals, thin
  `border` divider only — reads like a receipt line, not a card.

### 7.3 Inputs
Warm `--ring` focus (lamplight), never a cold blue ring. Label sits above
the field; on focus it does a `quick`/`breeze` micro-settle, not a jump.

### 7.4 Badges — "collectible," not a flat tag
Small inset border + subtle top highlight (like an enamel pin or wax seal),
never a flat single-color rounded rect.

### 7.5 Navigation — two personas, two treatments
- **Customer app**: sticky glass header, harbor-tinted blur, pill nav
  items.
- **Business panel**: quiet fixed sidebar (a workspace, not a storefront) —
  different information density, different radius family (7.4 product
  tier), no glass/blur.

### 7.6 Maps
Custom muted map style (teal water, warm stone land, no default
red/blue pins) — a harbor-buoy shaped marker in `--brand`, map container
gets `radius-lg`, never a hard rectangular crop against a white page.

### 7.7 Progress / live indicators
Soft pulsing `glow-lamplight`, never a harsh blinking dot or a flat
percentage bar.

---

## 8. Layout principles

- Container widths: content `72rem` max, editorial/reading measure `65ch`.
- Section rhythm follows §3 tier 3 (64–160px) — this is non-negotiable
  breathing room, not a "when there's room" nicety.
- Landing/storytelling sections may break the symmetric grid (asymmetric
  image/text splits, full-bleed moments) — the dashboard and panel never
  do; they stay on a strict, calm grid (operational clarity > drama).

---

## 9. Accessibility

- Contrast: 4.5:1 minimum all text; body copy targets 7:1 (AAA) where the
  palette allows (checked in §2 token table).
- Focus is always visible — warm `--ring`, 2px offset, never `outline: none`
  without a replacement.
- Touch targets ≥44×44px.
- Reduced motion via the CSS-first pattern in §6 — no exceptions.
- Semantic HTML and keyboard operability for every interactive primitive
  (buttons are `<button>`, links are `<a>`, custom controls get full
  keyboard + ARIA).

---

## 10. Implementation notes (for the rebuild phase)

- Fonts: Newsreader, Instrument Sans, IBM Plex Mono are all on Google
  Fonts — loadable via `next/font/google` exactly like phase 1's setup,
  no self-hosting needed. Verify Turkish glyphs (ş ğ ı İ ö ü ç) render
  correctly in all three at implementation time; fall back per §1 if not.
- This replaces `tailwind.config.ts` color/font tokens and
  `app/globals.css` CSS variables from phase 1 wholesale — not additive.
  Every component touched in phase 1 (`components/ui/*`, `nav-bar.tsx`,
  landing/discover/business-profile pages) gets rebuilt against these
  tokens, not patched.
- Do not reintroduce phase-1 tokens (`primary`/`accent`/`dark`/`ink`
  Tailwind color names, Fraunces, Plus Jakarta Sans) anywhere once the
  rebuild starts — mixing old and new is explicitly out of bounds per this
  brief.
