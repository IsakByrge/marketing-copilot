# 09 — Recommended Next Sprint

Two foundations are already merged on `main`: **Security Foundation** and **Design System
Foundation** (dormant). The highest-leverage next step depends on priority, but the audit's
recommendation is below, followed by the runner-up.

---

## Recommended Sprint: "Strategist Loop Closure + Design System Adoption (Wave 1)"

The strategist and content engines are real and working, but a user **cannot find their way back to
a saved strategy or draft** — which quietly undermines the entire Content Engine investment. At the
same time the approved emerald design system renders nowhere. This sprint closes the strategist loop
*and* proves design-system adoption on the pages it touches, so new work lands on the approved system
instead of adding a fourth palette.

### Sprint Goal

Make saved strategies and drafts **retrievable and reusable**, and ship the **first real pages built
on the emerald design system**, without disturbing the frozen legacy routes.

### Scope

1. **Strategy list + detail** — rebuild `/campaigns` (or a new `/strategies`) to read
   `campaign_strategies` via `normalizeStrategyContext()` (handles v1+v2), list saved strategies,
   and link each to `/content/facebook?strategy=<id>`. *(Closes C4/H-loop.)*
2. **Saved drafts view** — list `content_drafts` (channel, created_at, edited status) with a detail
   view. *(Closes "written but never read".)*
3. **In-progress session persistence** — persist the `/campaign-builder` brief/analysis/answers to
   `sessionStorage` so a reload doesn't lose the flow.
4. **Design system adoption, wave 1** — build these two new pages entirely with
   `app/_shared/primitives.tsx` + emerald tokens. Add the **missing primitives they need** (at
   minimum: a **Table/list-row**, and a **Dialog/Modal** or **Drawer** for detail) to the approved
   system.
5. **Verify migrations `0002` + `0003` are run** in every environment; capture RLS state.

### Dependencies

- Migration `0002` (`campaign_strategies`, `content_drafts`) and `0003` (`ai_usage_events`) must be
  applied in the target environment.
- The emerald primitive set must gain Table + Dialog/Drawer before the two new pages can be built
  purely on it (this is part of the sprint).
- The v1/v2 `adapter.ts` (already tested) is the read path for `strategy_context`.

### Risks

| Risk | Mitigation |
|---|---|
| Mixed v1/v2 `strategy_context` shapes | Route all reads through `normalizeStrategyContext()`; it's already covered by tests. |
| Building new pages in emerald introduces a *third* live palette instead of consolidating | Freeze scope to *new* pages only; do not touch legacy routes; the emerald pages become the reference for later migration. |
| Missing Dialog/Drawer forces an ad-hoc component | Add them to `primitives.tsx` as first-class, token-driven primitives with accessibility (focus trap, ESC, aria) — not one-offs. |
| Unverified RLS on original tables | Confirm and check in a `0000_baseline.sql` as part of the sprint. |
| No CI to catch regressions | Add a minimal GitHub Actions workflow (lint/typecheck/build/tests) as a sprint side-task. |

### Definition of Done

- [ ] `/campaigns` (or `/strategies`) lists saved strategies from `campaign_strategies` and links to
      the Facebook Specialist; empty state is honest.
- [ ] A drafts view lists `content_drafts` with a detail view.
- [ ] Reloading `/campaign-builder` mid-flow preserves brief + analysis + answers.
- [ ] The two new pages render **only** emerald primitives/tokens; no new inline palette added.
- [ ] `Table` (or list-row) and `Dialog`/`Drawer` primitives added to `primitives.tsx` with keyboard
      + screen-reader support and reduced-motion compliance.
- [ ] Migrations `0002`/`0003` confirmed applied; RLS on `companies`/`plans`/`content_feedback`
      verified and captured as `0000_baseline.sql`.
- [ ] `npm run lint`, `npx tsc --noEmit`, `npm run build`, and all four test scripts green.
- [ ] No changes to frozen legacy routes or the dark Mission Control system.

---

## Runner-up sprint: "Cost & Abuse Hardening + DB-backed limits"

(As recommended in `RELEASE_REVIEW.md`.) Move rate-limit + usage counting to a shared Supabase-backed
counter (global limits instead of per-instance), add a configurable monthly cost cap with automatic
soft-shutdown, pin IP per connection in the SSRF layer to close DNS-rebinding, and verify migrations
in all environments. Choose this first **only if** production traffic/cost exposure is the pressing
concern; otherwise the loop-closure sprint delivers more user-visible value.
