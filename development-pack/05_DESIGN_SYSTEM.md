# 05 — Design System

The repository currently contains **three visual languages**, which is the central design finding:

1. **Emerald (light)** — the *approved* design system. NEW, additive, token-driven, **dormant**
   (`app/globals.css` `@theme static` + `app/_shared/primitives.tsx`). Nothing renders it yet.
2. **Mission Control (dark)** — the *active* system for the 7 newer pages (`app/_shared/theme.ts`
   + `ui.tsx` + `Shell.tsx`).
3. **Legacy gold/graphite (dark)** — the `--mc-*` tokens + `.mc-*` classes in `globals.css`, used by
   the legacy routes. Plus the landing page `/` which is a **fourth**, one-off style.

---

## Emerald design system (approved, dormant)

Tokens are defined in `app/globals.css` under `@theme static` (the `static` keyword forces every
token into `:root` so Tailwind v4 does not tree-shake unreferenced ones).

### Colors (locked base palette)

| Token | Value | Utility |
|---|---|---|
| `--color-background` | `#F5FAF8` | `bg-background` |
| `--color-surface` | `#FFFFFF` | `bg-surface` |
| `--color-surface-sunken` | `#EFF5F2` | `bg-surface-sunken` |
| `--color-primary` | `#0F6B5B` | `bg/text/border-primary` |
| `--color-primary-hover` | `#0B5A4C` | `hover:bg-primary-hover` |
| `--color-text-primary` | `#111111` | `text-text-primary` |
| `--color-text-secondary` | `#5E6763` | `text-text-secondary` |
| `--color-text-tertiary` | `#6E7772` | `text-text-tertiary` |
| `--color-border` | `#E5ECE8` | `border-border` |
| `--color-border-strong` | `#D3DFDA` | `border-border-strong` |

**Status colors** (`success`/`danger`/`warning` + `*-surface`) are marked **provisional** in the CSS
— they are accessible defaults, not part of the locked palette, and must be confirmed.

### Typography

- **Geist** is the design-system typeface (`--font-geist` registered in `layout.tsx`, referenced by
  `--font-sans`). Weights 400/500/600.
- Legacy fonts (Outfit sans, Cormorant Garamond serif) remain registered **additively** for the
  frozen dark/legacy pages.

### Radius

`--radius-sm: 6px`, `--radius: 8px` (standard), `--radius-lg: 12px` (maximum). Blueprint rule:
**standard 8px, maximum 12px**.

### Shadows / elevation

Light and low, never glow: `--shadow-xs`, `--shadow-sm`, `--shadow-md` (max `0 4px 12px -4px
rgba(17,17,17,0.08)`). **Resting Cards carry no shadow** — separation comes from background, border
and spacing.

### Spacing & motion

Spacing uses Tailwind's default scale via utilities (no custom spacing tokens). Motion tokens
(`--ease-standard`, `--duration-fast: 150ms`, `--duration-base: 200ms`) exist and are **neutralised
globally** by a `prefers-reduced-motion` block. A `z-index` scale is defined
(`--z-nav/drawer/modal/toast`).

### Primitives (see `04_COMPONENTS.md`)

Buttons, IconButton, Card, Input, Textarea, Field, Chip, Alert, Skeleton, EmptyState, Spinner — all
CSS-only interaction states, `focus-visible` emerald ring, WCAG 2.5.5 44×44 touch targets.

---

## Element-by-element status against the approved system

| Element | Approved (emerald) implementation | Currently used in app? |
|---|---|---|
| **Typography** | Geist + weight tokens | ❌ pages still use Cormorant/Outfit |
| **Spacing** | Tailwind scale | ❌ legacy uses fixed px in inline styles |
| **Colors** | emerald tokens | ❌ pages use dark purple / gold |
| **Design tokens** | `@theme static` CSS vars | ⚠ defined, consumed only by primitives |
| **Radius** | 6/8/12px | ❌ legacy uses 2px & 10–16px |
| **Shadows** | xs/sm/md, no glow | ❌ Mission Control uses purple glow shadows |
| **Buttons** | `Button`/`IconButton` primitives | ❌ pages use `PrimaryButton`/`GhostButton`/`.mc-btn-*` |
| **Inputs** | `Input`/`Textarea`/`Field` | ❌ pages use `TextInput`/`TextArea`/`.mc-input` |
| **Cards** | `Card` (no resting shadow) | ❌ pages use `ResultCard`/`.mc-surface` |
| **Tables** | — **not defined** | ❌ no table primitive exists anywhere |
| **Dialogs** | — **not defined** | ❌ no modal/dialog primitive exists |
| **Drawers** | — **not defined** as primitive | ⚠ `Shell.tsx` has a bespoke mobile drawer (JS) |
| **Sheets** | — **not defined** | ❌ no sheet primitive exists |

---

## Evaluation: does the implementation follow the approved Design System?

**Partially — by design, and only at the foundation layer.**

- ✅ The **token foundation and primitive library are correct and complete** for the elements they
  cover (buttons, inputs, cards, chips, alerts, skeletons, empty states). They faithfully encode the
  approved emerald palette, 8/12px radius, light elevation, Geist type, accessibility rules
  (44×44 targets, `focus-visible`, reduced-motion, aria wiring).
- ⚠ **No page renders the approved system yet.** Adoption was deliberately deferred; the sprint was
  scoped as *additive foundation only*, freezing the dark pages and legacy routes untouched.
- ❌ **Missing primitives:** Table, Dialog/Modal, Drawer, Sheet, Tabs, Toast, Menu. Any page that
  needs these has no approved building block.
- ❌ **Three-to-four coexisting palettes** (emerald, Mission Control purple, legacy gold, landing-page
  beige) mean a user still traverses different visual worlds mid-flow (e.g. `/dashboard` → `/plan`).
- ⚠ **Token duplication** persists in the frozen layer: the Mission Control `T` object is duplicated
  inline across several files, and `/campaign-builder` holds a *third* inline copy of the purple
  palette (naming its accent `gold` though it is purple).

**Verdict:** the design-system *foundation* is production-quality and on-spec. The design system as
an *applied product surface* is **~0% adopted** — the real work (migrating pages, adding
Table/Dialog/Drawer/Sheet primitives, retiring the legacy palettes) is still ahead. This is the
single largest UX debt and a natural next sprint.
