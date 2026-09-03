# TarotApp (Reader Console) — Design System

Extracted from the codebase for reuse in other projects. Stack: Next.js App Router + Tailwind CSS (`darkMode: 'class'`, not currently used), `@tailwindcss/forms`, `clsx` + `tailwind-merge` for a `cn()` helper, `lucide-react` for icons.

A calm, functional internal-tool aesthetic: light neutral surfaces, a single indigo accent, dense information tables, soft rounded corners, minimal shadows. Not decorative — built for fast scanning of orders/status data.

---

## 1. Color Palette

### Brand accent (indigo) — `tailwind.config.ts`
Used for primary actions, links, focus rings, active states.

| Token | Hex |
|---|---|
| brand-50 | `#eef2ff` |
| brand-100 | `#e0e7ff` |
| brand-200 | `#c7d2fe` |
| brand-300 | `#a5b4fc` |
| brand-400 | `#818cf8` |
| brand-500 | `#6366f1` |
| brand-600 | `#4f46e5` ← primary button / links |
| brand-700 | `#4338ca` ← primary button hover |
| brand-800 | `#3730a3` |
| brand-900 | `#312e81` |
| brand-950 | `#1e1b4b` |

### Navy (sidebar only)
| Token | Hex | Use |
|---|---|---|
| navy (DEFAULT) | `#0f1629` | Sidebar background |
| navy-light | `#1a2744` | (available, unused in reviewed files) |
| navy-muted | `#2d3f6b` | (available, unused in reviewed files) |

### Neutrals
Standard Tailwind `slate` scale is used throughout for text, borders, and surfaces — no custom neutral palette. Key ones in practice:
- `slate-50` — page background (`bg-slate-50`)
- `slate-100` — subtle fills (tab bar bg, hover states, secondary badges)
- `slate-200` — borders/dividers (default card/table border)
- `slate-300` — input borders, disabled toggle track
- `slate-400` — placeholder/muted text, disabled text
- `slate-500` — secondary/meta text
- `slate-600`–`slate-700` — body text on light backgrounds
- `slate-800`–`slate-900` — headings, primary text, high-emphasis values

### Semantic / status colors
**Status** badge variants follow `bg-{color}-50 text-{color}-700 ring-1 ring-inset ring-{color}-200`. The plain `default` badge is the exception — it is a flat `bg-slate-100 text-slate-700` with **no ring**, and is what you get when no status variant applies:

| Meaning | Color |
|---|---|
| Pending / Warning / Test / Due Today | amber |
| In Progress | blue |
| Awaiting Review | purple |
| Sent / Success | green |
| Archived / Default | slate |
| Rush / Danger / Error | red |

Standalone semantic hexes: none custom — all via Tailwind's default `red`, `amber`, `blue`, `green`, `purple` scales at `-50`/`-200`/`-600`/`-700` shades.

Rush-order row highlight: `bg-red-50/40` (30–40% opacity tint over white row).

### Buttons color map
- Primary: `bg-brand-600` → hover `bg-brand-700`, disabled `bg-brand-300`, text white
- Secondary: `bg-slate-100` → hover `bg-slate-200`, text `slate-800`
- Outline: `border-slate-300 bg-white text-slate-700` → hover `bg-slate-50`
- Ghost: transparent → hover `bg-slate-100`
- Danger: `bg-red-600` → hover `bg-red-700`

---

## 2. Typography

**Font:** Inter (Google Font via `next/font/google`), loaded as CSS variable `--font-inter`, applied as `font-sans` with fallback stack `['Inter', 'system-ui', 'sans-serif']`.

No custom `fontSize` scale in Tailwind config — uses Tailwind defaults directly.

### Scale in practice (size / weight / color / tracking)
| Role | Classes |
|---|---|
| Page title (h1) | `text-xl font-bold text-slate-900` (or `text-2xl font-bold` on login screen) |
| Section heading (h2) | `text-sm font-semibold text-slate-900` |
| Eyebrow / brand kicker | `text-[10px]`–`text-xs font-semibold uppercase tracking-widest text-slate-400/500` |
| Table header | `text-xs font-semibold text-slate-500 uppercase tracking-wide` |
| KPI label | `text-xs font-medium text-slate-500 uppercase tracking-wide` |
| KPI value | `text-2xl font-bold text-slate-900` (or `text-brand-700` when accented) |
| Body / table cell | `text-sm text-slate-600`–`text-slate-800` |
| Primary emphasis (name, value) | `font-medium text-slate-800/900` |
| Meta / secondary text | `text-xs text-slate-400` |
| Monospace (order IDs) | `font-mono text-xs text-slate-500` |
| Button text | `text-xs` (sm), `text-sm` (md/lg), always `font-medium` |
| Nav item | `text-sm font-medium` |
| Badge text | `text-xs font-medium` |

Font smoothing is forced on: `-webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;`.

---

## 3. Spacing Scale

No custom spacing scale — pure Tailwind defaults (4px base unit). Observed conventions:

- **Page padding:** `p-6`, content capped with `max-w-6xl mx-auto`
- **Section vertical rhythm:** `space-y-6` between major page sections
- **Card padding:** `p-5` (default `Card`/`KPICard`), `p-8` (login card), `p-4` (recent-item cards)
- **Table cell padding:** `px-4 py-3` (body), `px-4 py-2.5`–`py-3` (header)
- **Button padding:** sm `px-3` / md `px-4` / lg `px-5`, all with matching heights below
- **Gaps:** `gap-1.5` (icon+text pairs), `gap-2`–`gap-3` (button groups, nav icon gap), `gap-4` (grid/KPI gaps, and the top bar)
- **Form field spacing:** `space-y-4` between fields, `mb-1` label-to-input

### Fixed heights (controls)
| Element | Height |
|---|---|
| Button sm | `h-8` |
| Button md | `h-10` |
| Button lg | `h-11` |
| Top bar | `h-14` |
| Test-mode banner | `h-7` |
| Toggle track | `h-5 w-9`, thumb `h-4 w-4` |
| Nav item min-height | `min-h-[44px]` (touch target) |

---

## 4. Border Radius

- `rounded-md` (6px) — small badges, icon chips
- `rounded-lg` (8px) — buttons, inputs, nav items — the default control radius
- `rounded-xl` (12px) — cards, tables, panels — the default container radius
- `rounded-2xl` (16px) — the login card only (larger standalone surface)
- `rounded-full` — toggle pill, avatar/count badges, scrollbar thumb

---

## 5. Shadows & Elevation

Elevation is used very sparingly — flat design with borders doing most of the separation work.

- `shadow-sm` — the *only* shadow used, applied to: cards, KPI cards, active tab pill, toggle thumb
- No `shadow-md`/`lg`/`xl` anywhere in reviewed components
- Layering/separation is achieved primarily with `border border-slate-200` rather than shadow
- Mobile sidebar overlay: `bg-black/50` scrim, no shadow

---

## 6. Component Patterns

### Buttons (`components/ui/Button.tsx`)
```
inline-flex items-center justify-center rounded-lg font-medium transition-colors
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1
disabled:cursor-not-allowed
```
5 variants (primary/secondary/outline/ghost/danger) × 3 sizes (sm/md/lg). Loading state swaps in an inline spinning SVG (`animate-spin`), button stays same size. Icons (Lucide) placed inline before label text, sized 12–18px depending on context.

### Cards (`components/ui/Card.tsx`)
Base card: `rounded-xl border border-slate-200 bg-white shadow-sm`, optional `p-5`.
KPICard: same shell + `accent` boolean variant that swaps to `border-brand-200 bg-brand-50` / `text-brand-700` — used for the one "hero" metric (revenue).
Icon chip inside KPICard: `rounded-lg p-2 bg-slate-100 text-slate-500` (or brand-tinted if accented).

### Badges (`components/ui/Badge.tsx`)
Pill/chip pattern: `inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium`. Status variants use a **soft-fill + inset ring** recipe: `bg-{c}-50 text-{c}-700 ring-1 ring-inset ring-{c}-200`. A `StatusBadge` wrapper maps raw status strings (`pending`, `in_progress`, etc.) to display labels.

### Tables (orders/dashboard queue)
Wrapped in `overflow-x-auto rounded-xl border border-slate-200 bg-white`. Header row: `bg-slate-50 border-b border-slate-200`, cells `text-xs font-semibold text-slate-500 uppercase tracking-wide`. Body rows separated by `divide-y divide-slate-100`, hover state `hover:bg-slate-50/50`, special-state rows (rush orders) get a translucent tint `bg-red-50/30`–`/40` rather than a solid color or left border.

### Forms
Inputs/Selects: `rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm`, focus state `focus:border-brand-500 focus:ring-1 focus:ring-brand-500`, error state swaps to red-400/500. Labels: `text-sm font-medium text-slate-700 mb-1` with a red asterisk for required fields.

### Tabs
Segmented-control style: track `rounded-lg bg-slate-100 p-1`, active tab `bg-white text-slate-900 shadow-sm`, inactive `text-slate-500`.

### Toggle
iOS-style switch: `h-5 w-9` pill track (`bg-brand-600` on / `bg-slate-300` off), `h-4 w-4` white thumb sliding via `translate-x`.

### Sidebar / Navigation
Dark navy shell (`bg-navy`) distinct from the light app body — the one deliberate light/dark contrast point in the UI. Nav items: `rounded-lg px-3 py-2.5 min-h-[44px]`, active = `bg-white/10 text-white`, inactive = `text-slate-400` → hover `bg-white/5 text-white`. Icons from `lucide-react`, 17px. Collapses to icon-only rail below `lg` breakpoint, full off-canvas drawer with scrim below `md`.

### Top bar
`h-14 border-b border-slate-200 bg-white`, hamburger menu only visible `md:hidden`.

### Calendar grid (`components/daily-message/CalendarView.tsx`)

Added Sep 2026, after the rest of this document was written — recorded here so it
doesn't become the next round of undocumented drift.

Month grid: `grid grid-cols-7 gap-px bg-slate-100 p-px` — a 1px slate-100 parent
showing through the gaps acts as the cell grid lines, so no per-cell borders are
needed. Day cells are `min-h-[64px]` flex columns.

Cell state colours reuse the soft-fill family rather than inventing new ones:

| State | Classes |
|---|---|
| Empty (actionable) | `bg-white text-slate-700 hover:bg-slate-50` |
| Generated, unapproved | `bg-amber-50 text-amber-800 border-amber-200` |
| Approved | `bg-green-50 text-green-800 border-green-200` |
| Skipped | `bg-slate-100 text-slate-400 border-dashed border-slate-300` |
| Locked (past) | `bg-slate-100 text-slate-400` / `bg-slate-50 text-slate-300` if empty |

Two rules worth carrying to any similar grid:

- **`border-dashed` marks a deliberate non-state** (a skipped day), distinguishing
  "intentionally nothing here" from "nothing here yet". Dashed = chosen emptiness.
- **Emphasis rings must be `ring-inset` inside a tight grid.** `ring-2 ring-inset
  ring-brand-400` marks today; `ring-2 ring-inset ring-red-400` marks today when it
  still needs action. An *outset* ring (`ring-offset-*`) is a box-shadow that is not
  clipped by sibling cells — with `gap-px` it bleeds through the gap into the row
  below as a stray line. That was a real bug; inset is the fix.

Truncation inside cells uses `line-clamp-2` at `text-[10px] leading-tight`.

### Alert / inline banners
Error banner (forms): `rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700`.

> **`text-red-700`, not `red-600`, and this one matters.** On a `bg-red-50` fill,
> `text-red-600` measures **4.41:1 — below the WCAG AA 4.5:1 minimum**; `text-red-700`
> measures 5.91:1 and passes. It also matches the soft-fill recipe used everywhere else
> (`bg-{c}-50` pairs with `text-{c}-700`, including `rush: bg-red-50 text-red-700`).
> Note this applies only *on a red-50 fill* — `text-red-600` on white is 4.83:1 and
> passes AA, which is why the ~11 standalone red-600 uses (required-field asterisks,
> destructive link text) are correct as they are and should not be changed.
Test-mode banner: full-width strip, `bg-amber-100 border-b border-amber-200 text-amber-800`, `h-7`.

---

## 6b. Reuse in the leadgen dashboard (`dbd-leadgen-dashboard`)

That project ports this design system verbatim — its `tailwind.config.ts` is
substantively identical (same brand scale, same navy, same Inter stack, same
`fade-in`/`slide-down` keyframes, same `@tailwindcss/forms`), and Button, Card, Badge,
Tabs, Input and Label match the recipes above. Two divergences to know about:

**TarotApp-only — do not expect these in leadgen:**
- `Toggle` (the `h-5 w-9` iOS switch) — no equivalent component exists there
- `TestModeBanner` (the `h-7` amber strip) — TarotApp-specific feature

**Leadgen-only — not present here:**
- `components/ui/Pagination.tsx`
- **Size-tier badge palette**, keyed to a lead's follower count. Uses the same
  soft-fill + inset-ring recipe, extending it to two colours this document doesn't
  otherwise use (`yellow`, `indigo`):

| Tier | Followers | Classes |
|---|---|---|
| bronze | 10,000+ | `bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200` |
| silver | 50,000+ | `bg-slate-200 text-slate-800 ring-1 ring-inset ring-slate-300` |
| gold | 100,000+ | `bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-200` |
| platinum | 250,000+ | `bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200` |
| elite | 500,000+ | `bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-200` |

  Note `silver` breaks the `-50`/`-700` pairing (it is `slate-200`/`slate-800`) because
  `slate-50` on a white card is nearly invisible. A deliberate exception, not drift.

---

## 7. Distinctive Visual Patterns

1. **Soft-fill + inset-ring badges** — the signature status-indicator style (`bg-{c}-50 ring-1 ring-inset ring-{c}-200 text-{c}-700`) rather than solid-color chips. Reuse this exact recipe for any status/tag UI.
2. **Dark sidebar / light canvas split** — only the navigation rail is dark (`navy` `#0f1629`); everything else is white/`slate-50`. Creates a clear "chrome vs. content" boundary without a full dark theme.
3. **Border-first elevation** — `shadow-sm` is used almost decoratively; real separation comes from 1px `slate-200` borders. Keeps the UI feeling flat/dense rather than "card-soup."
4. **Translucent state tints on rows**, not solid backgrounds or left-border accents (e.g. rush orders = `bg-red-50/30`, not a red left-bar).
5. **Uppercase tracked-wide micro-labels** (`text-xs uppercase tracking-wide text-slate-500`) used consistently for table headers and KPI labels — the small-caps-like eyebrow treatment is a recurring motif, also used for the brand kicker ("DEEP BLUE DIVINATION").
6. **44px minimum touch targets** on nav items even though this is a desktop-first internal tool — accessibility-conscious sizing.
7. **Consistent icon sizing by context**: 17px nav icons, 18px KPI icons, 14px button icons, 11–13px inline meta icons (all from `lucide-react`, `strokeWidth` default).
8. **Focus rings** are brand-colored and consistent everywhere: `focus-visible:ring-2 focus-visible:ring-brand-500` (offset 1).
9. **Currency formatting**: `£{value.toFixed(2)}` inline, not a separate component.
10. **Subtle custom scrollbar**: 6px thin scrollbar, `slate-300` thumb → `slate-400` hover, transparent track (`globals.css`).
11. **Micro-animations kept short**: `fade-in` 0.15s and `slide-down` 0.15s (6px translate) — snappy, not showy.

---

## 8. Quick-reference Tailwind config to port

```ts
theme: {
  extend: {
    colors: {
      brand: {
        50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc',
        400: '#818cf8', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca',
        800: '#3730a3', 900: '#312e81', 950: '#1e1b4b',
      },
      navy: { DEFAULT: '#0f1629', light: '#1a2744', muted: '#2d3f6b' },
    },
    fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
    animation: {
      'fade-in': 'fadeIn 0.15s ease-in-out',
      'slide-down': 'slideDown 0.15s ease-out',
    },
    keyframes: {
      fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
      slideDown: {
        '0%': { transform: 'translateY(-6px)', opacity: '0' },
        '100%': { transform: 'translateY(0)', opacity: '1' },
      },
    },
  },
},
plugins: [require('@tailwindcss/forms')],
```

Body base: `font-sans antialiased bg-slate-50 text-slate-900`. Global focus ring: `outline-2 outline-offset-2 outline-brand-500` on `:focus-visible`.
