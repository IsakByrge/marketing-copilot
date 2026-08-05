# 04 — Components

Marking:
- ✅ **Production Ready** — safe, complete, actively used.
- ⚠ **Needs Refactor** — works, but design/architecture debt (e.g. inline styles, JS-driven hover,
  duplicated tokens).
- ❌ **Legacy / dead** — superseded, unused, or slated for removal.

There are **no top-level `components/` or `hooks/` folders**. Reusable components live in
`app/_shared/`. Two design-system component layers coexist there.

---

## A. Emerald design system — `app/_shared/primitives.tsx` (NEW, dormant)

Styled purely with Tailwind v4 utilities on approved tokens; CSS-only interaction states +
`focus-visible`. **Built and tested, but not yet rendered by any page.**

| Component | Purpose | Status |
|---|---|---|
| `cx()` | className joiner utility | ✅ |
| `Spinner` | CSS-only progress ring (reduced-motion aware) | ✅ |
| `Button` | variants primary/secondary/ghost, sizes sm/md, `loading` state | ✅ |
| `IconButton` | fixed 44×44 touch target (WCAG 2.5.5), `loading` | ✅ |
| `Card` | no resting shadow; no `interactive` prop (no clickable `<div>`s) | ✅ |
| `Input` | text field, `invalid` wiring | ✅ |
| `Textarea` | multiline, `invalid` wiring | ✅ |
| `Field` | labelled wrapper, render-prop, id/aria-describedby wiring | ✅ |
| `Chip` | tones neutral/primary/success/danger/warning | ✅ |
| `Alert` | tones info/success/warning/danger, role=alert/status | ✅ |
| `Skeleton` | shapes line/block/circle (reduced-motion aware) | ✅ |
| `EmptyState` | honest empty view | ✅ |

> These are production-quality but **dormant** — the "production ready" mark reflects code quality,
> not live usage. Adoption is a future sprint.

---

## B. Mission Control design system — `app/_shared/ui.tsx` (ACTIVE, dark)

Styled with inline `style` objects + JS-driven hover (`onMouseOver`/`onMouseOut`). Used by the 7
newer pages and migrated quick-flows.

| Component | Purpose | Status |
|---|---|---|
| `Eyebrow` | uppercase label with rule | ⚠ inline styles |
| `PrimaryButton` | gradient CTA (JS hover) | ⚠ |
| `GhostButton` | outline button (JS hover) | ⚠ |
| `PageHeader` | eyebrow + serif title + subtitle | ⚠ |
| `EmptyState` | dashed honest empty view | ⚠ |
| `SectionLabel` | compact section label | ⚠ |
| `Field` | labelled field wrapper | ⚠ |
| `TextInput` | input with focus ring (JS focus/blur) | ⚠ |
| `TextArea` | textarea with focus ring | ⚠ |
| `ChoiceCard` | selectable card, keyboard-accessible (`.mcx-focusable`) | ⚠ |
| `CopyButton` | copy-to-clipboard with "Kopierat" feedback | ⚠ |
| `ResultBlock` | label + generated content block | ⚠ |
| `ResultCard` | elevated result surface | ⚠ |
| `LoadingPanel` | stepwise loading progression | ⚠ |
| `ErrorNote` | non-technical error box | ⚠ |

> **Duplication note:** two components named `EmptyState` and `Field` now exist (one in `ui.tsx`,
> one in `primitives.tsx`). This is intentional during the additive migration but is a naming hazard.

---

## C. App shell & icons — `app/_shared/`

| Export | File | Purpose | Status |
|---|---|---|---|
| `Shell` (default) | `Shell.tsx` | Sidebar (desktop) / drawer (mobile) nav wrapper; JS breakpoint `useIsCompact()` at 900px | ⚠ JS-driven responsiveness (layout shift on mobile first render) |
| `NAV_ITEMS` | `Shell.tsx` | Nav config | ✅ |
| `firstNameFromEmail()` | `Shell.tsx` | Greeting helper | ✅ |
| 20 `Icon*` components | `icons.tsx` | Hand-authored SVG icons (`IconToday`, `IconBuilder`, `IconCampaigns`, `IconContent`, `IconCompany`, `IconHistory`, `IconSettings`, `IconLogout`, `IconMenu`, `IconClose`, `IconArrowRight`, `IconRisk`, `IconOpportunity`, `IconRecommendation`, `IconChevronDown`, `IconPlus`, `IconTrash`, `IconPencil`, `IconCheck`, `IconX`, `IconSparkle`) | ✅ |

---

## D. Client hooks — `app/_shared/`

| Hook | Purpose | Status |
|---|---|---|
| `useAccountData` | Loads profile + latest plan + history; `localStorage` fallback | ⚠ `localStorage` not cleared on logout |
| `useCompanyBrain` | Loads/saves Company Brain JSONB | ⚠ client-side write, validation only on read |

---

## E. Domain / engine modules (not visual components, but the reusable core)

| Module | Key exports | Status |
|---|---|---|
| `app/_shared/companyBrain.ts` | types, `sanitizeBrain`, `migrateProfileToBrain`, completeness, gaps, AI context | ✅ (untested) |
| `lib/strategist/validate.ts` | `coerceAnalyze`, `coerceRecommend`, `MAX_FOLLOWUPS` | ✅ tested |
| `lib/strategist/adapter.ts` | `isStrategyV2`, `normalizeStrategyContext` | ✅ tested |
| `lib/strategist/request.ts` | `parseBrief`, `parseAnswers`, `parseAnalysis` | ✅ |
| `lib/strategist/prompts.ts` | `ANALYZE_SYSTEM`, `RECOMMEND_SYSTEM`, builders | ✅ |
| `lib/strategist/model.ts` | `callJson`, model/timeout config | ✅ |
| `lib/facebook/specialist.ts` | `runFacebookSpecialist`, `criticalFollowUp`, `FB_MODELS` | ✅ (untested) |
| `lib/facebook/quality.ts` | `detectCliches`, `detectFabricatedSocialProof`, `dedupeAlternatives`, `deriveUserStatus` | ✅ tested (prefill) |
| `lib/facebook/context.ts` | `buildFacebookContext` | ✅ |
| `lib/facebook/strategyPrefill.ts` | `mapStrategyToPrefill` | ✅ tested |
| `lib/server/*` | security layer (see `02_ARCHITECTURE.md`) | ✅ tested (ssrf/rate/validation) |

---

## F. Dead / legacy modules — ❌

| Module | Reason |
|---|---|
| `app/campaign-builder/config.tsx`, `reasoning.ts`, `goal-profiles.ts`, `analysis.ts` | v1 Strategist modules, no live consumer after v2 rewrite |
| `lib/campaignStrategyStore.ts` → `saveCampaignStrategy()`, `buildStrategyContext()` | v1 persistence, no caller (v2 `saveStrategyV2()` is active) |
| `lib/mockPlans.ts`, `lib/planStorage.ts`, `lib/generatedPlan.ts` | not imported anywhere |
| `lib/supabase.ts` | anon client without session (legacy pattern) |
| `veckoplan-app.jsx` (root), `node update-colors.js` (root) | standalone prototype / one-off script, excluded from lint |
| `public/*.svg` (file, globe, next, vercel, window) | unused create-next-app assets |

---

## Component count summary

- **Emerald primitives:** 12 exports (10 components + `Spinner` + `cx`).
- **Mission Control components:** 15.
- **Shell + helpers:** 3, plus **20 SVG icons**.
- **Client hooks:** 2.
- **Reusable engine/domain modules:** ~11.

**≈ 50 reusable UI components/primitives/icons**, of which **~27 are visual components**
(12 emerald + 15 Mission Control) and 20 are icons.
