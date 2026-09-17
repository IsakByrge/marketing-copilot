# 11 — Master TODO / Roadmap

A prioritized, sprint-by-sprint roadmap. Sprints 0–2 are already **merged** on `main` and shown for
context. Everything from Sprint 3 onward is the forward plan.

Effort key: **S** small, **M** medium, **L** large.

---

## ✅ Sprint 0 — Marketing Strategist 2.0 (DONE, merged)
- 4-phase strategist flow, engine, v1/v2 adapter, tests. Facebook Specialist adapted to v2.

## ✅ Sprint 1 — Security Foundation (DONE, merged)
- Closed open AI proxy, session-derived identity, SSRF + prompt-injection hardening, guarded image
  routes, rate-limit + usage logging, safe errors, migration `0003`.

## ✅ Sprint 2 — Design System Foundation (DONE, merged, dormant)
- Emerald tokens (`@theme static`), Geist font, primitives in `primitives.tsx`, route-smoke script.
  Additive only — nothing renders it yet.

---

## ▶ Sprint 3 — Foundation Verification & Guardrails *(do first)*
Unblocks everything else; small but load-bearing.
- [ ] **[S]** Export + commit `0000_baseline.sql` for `companies`/`plans`/`content_feedback`; verify RLS. *(B1/B2)*
- [ ] **[S]** Confirm migrations `0002`+`0003` applied in all environments. *(B2)*
- [ ] **[S]** Add `.env.example` + a real README documenting env vars + manual migration steps. *(B3, L7)*
- [ ] **[S]** Add GitHub Actions CI: `npm ci`, lint, typecheck, build, all 4 test scripts. *(M6)*
- [ ] **[S]** Clear `localStorage` on logout. *(M8)*

## ▶ Sprint 4 — Strategist Loop Closure + Design Adoption Wave 1 *(recommended headline sprint — see 09)*
- [ ] **[M]** `/campaigns` (or `/strategies`) lists saved strategies via `normalizeStrategyContext()`; links to Facebook Specialist. *(closes C4)*
- [ ] **[M]** Saved-drafts view over `content_drafts`. *(closes "written, never read")*
- [ ] **[S]** Persist in-progress strategist session to `sessionStorage`. *(C11)*
- [ ] **[M]** Add `Table`/list-row + `Dialog`/`Drawer` primitives to the emerald system. *(B9)*
- [ ] **[M]** Build the two new pages purely on emerald tokens/primitives (no new palette). *(H5 wave 1)*

## ▶ Sprint 5 — Cost & Abuse Hardening
- [ ] **[M]** DB-backed shared rate-limit + usage counter (global, not per-instance). *(M2)*
- [ ] **[M]** Configurable monthly cost cap + automatic soft-shutdown. *(M3)*
- [ ] **[S]** Pin IP per connection in SSRF layer (close DNS-rebinding).
- [ ] **[S]** Set `content_drafts.updated_at` on write (trigger or code). *(L2)*

## ▶ Sprint 6 — Dead-code Removal & Consolidation
- [ ] **[S]** Delete dead API routes `campaign-analysis`, `campaign-interview`. *(D1)*
- [ ] **[S]** Delete v1 Campaign Builder modules + `saveCampaignStrategy()`. *(D2/D3)*
- [ ] **[S]** Delete `mockPlans`/`planStorage`/`generatedPlan`, `lib/supabase.ts`, root prototype/one-off, unused `public/*.svg`. *(D4–D7)*
- [ ] **[S]** De-duplicate the Mission Control `T` palette (incl. the `/campaign-builder` inline copy). *(M1)*
- [ ] **[S]** Resolve `EmptyState`/`Field` name collision between `ui.tsx` and `primitives.tsx`. *(L9)*

## ▶ Sprint 7 — Company Brain → Weekly Plan
- [ ] **[M]** Wire `companyBrainServer` into `/api/generate-plan`; retire the flat profile there. *(H3)*
- [ ] **[M]** Move `analyze-company` output into Company Brain with correct `source`/`confidence`.
- [ ] **[S]** Extract the hardcoded holiday calendar; fix ISO-week calc. *(M5)*
- [ ] **[S]** Add `company_id` FK constraints; reconsider `content_feedback.company_name` → FK. *(L5/L6)*

## ▶ Sprint 8 — Design System Adoption Wave 2 (legacy migration)
- [ ] **[L]** Migrate legacy pages (`/plan`, `/campaign`, `/newsletter`, `/create`, `/profile`, `/onboarding`, `/generating`, `/post/[id]`) onto emerald + a shared shell.
- [ ] **[M]** Merge `/profile` into `/company` (single company view). *(route overlap)*
- [ ] **[S]** Retire legacy `--mc-*` tokens + `.mc-*` classes once no route uses them.

## ▶ Sprint 9 — Reach / Measurement / Multi-channel (product growth)
- [ ] **[L]** Strategy editing + versioning ("revise this strategy").
- [ ] **[L]** Additional downstream specialists beyond Facebook (per `channelPriority`).
- [ ] **[L]** KPI measurement + write-back (`campaign_learned` provenance).
- [ ] **[M]** Budget/economics in `StrategyCore`.

## Backlog / hygiene (any sprint)
- [ ] **[M]** Upgrade `next` to clear the 4 high transitive vulns (read `node_modules/next/dist/docs/` first — breaking changes). *(L12, B11)*
- [ ] **[S]** Add security headers + image domains in `next.config.ts`. *(L8)*
- [ ] **[S]** Introduce a real test runner + coverage; test route handlers, Facebook engine, Company Brain fns. *(M7)*
- [ ] **[S]** Remove `design-reference.png` from repo root; rename `node update-colors.js`. *(L10/L11)*
- [ ] **[S]** Fix Cyrillic char in `campaignStrategyStore.ts` comment. *(L13)*
- [ ] **[L]** Reconsider `"use client"`-everything: introduce Server Components / SSR data fetching. *(M9)*
