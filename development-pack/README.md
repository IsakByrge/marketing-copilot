# Marketing Copilot — Development Pack

## Purpose

This Development Pack is a **complete, self-contained handoff package** describing the Marketing
Copilot repository so that **another engineer or AI can begin implementation without access to the
running system**. It is the output of a **read-only architectural audit**: no source code was
modified, no dependencies installed, no migrations run, nothing committed or pushed.

**Audit basis:** branch `main`, 2026-07-27. At this point `main` already contains two merged
foundation sprints — **Security Foundation** and **Design System Foundation** (the latter dormant).
Where the repo's own older review files (`SPRINT_REVIEW.md`, `RELEASE_REVIEW.md` at repo root)
describe earlier branches, this pack reflects the **current merged state**.

## How to use it

1. Read `01_REPOSITORY_OVERVIEW.md` and `02_ARCHITECTURE.md` for the mental model.
2. Use `03_ROUTES.md` + `04_COMPONENTS.md` as the surface-area inventory.
3. Use `08_TECH_DEBT.md`, `10_BLOCKERS.md`, and `13_ENVIRONMENT.md` before writing any code.
4. Use `09_NEXT_SPRINT.md` + `11_MASTER_TODO.md` to decide what to build.
5. Consult `database/` for schema/migrations/policies.

## Document index

| File | What it contains |
|---|---|
| `01_REPOSITORY_OVERVIEW.md` | Framework, language, package manager, versions (Next/React/Tailwind/TS), Supabase, auth, Vercel, routing/app/component structure. |
| `02_ARCHITECTURE.md` | Folders, domains, providers, hooks, services, lib, ui, api, middleware, the security layer, server/client split — with an ASCII diagram. |
| `03_ROUTES.md` | Every route (18 pages + 10 API + middleware) with status: production-ready / legacy / needs-refactor / missing. |
| `04_COMPONENTS.md` | Every reusable component/hook/engine module, marked ✅ / ⚠ / ❌. |
| `05_DESIGN_SYSTEM.md` | Typography, spacing, colors, tokens, radius, shadows, buttons, inputs, cards, tables, dialogs, drawers, sheets — and an evaluation against the approved (emerald) design system. |
| `06_COMPANY_BRAIN.md` | Data model, storage, API, UI, missing functionality, risks. |
| `07_CAMPAIGN_BUILDER.md` | Interview flow, strategist, specialists, generation flow, storage, current state, missing parts. |
| `08_TECH_DEBT.md` | Legacy/duplicated/dead code, TODO/FIXME, unused files, architectural risks — categorized High/Medium/Low. |
| `09_NEXT_SPRINT.md` | Recommended next sprint: goal, scope, dependencies, risks, definition of done. |
| `10_BLOCKERS.md` | Everything blocking implementation. |
| `11_MASTER_TODO.md` | Prioritized sprint-by-sprint roadmap. |
| `12_FILE_TREE.txt` | Full git-tracked repository tree (node_modules excluded). |
| `13_ENVIRONMENT.md` | Every environment variable (names only; secrets masked). |
| `package/` | `package.json` + `package-lock.json` (verbatim). |
| `database/SCHEMA.md` | Tables, columns, RLS policies, functions, how migrations run, what to verify. |
| `database/migrations/` | `0001`, `0002`, `0003` SQL (verbatim). |

## What is deliberately NOT included

- `.env.local` / any secrets (correctly gitignored; masked in `13_ENVIRONMENT.md`).
- `node_modules/` and build artifacts.
- Any modification to the repository — this pack is additive documentation only.

## Headline numbers

- **28 routes** = 18 pages + 10 API handlers (+1 middleware); **2 API routes are dead**.
- **~27 reusable visual components** (12 emerald + 15 Mission Control) + 20 icons + 2 hooks.
- **6 database tables** (3 unversioned baseline + 3 via migrations `0001`–`0003`).
- **Biggest risks:** (1) DB schema/RLS partly outside version control; (2) two parallel company data
  models; (3) design system 0% adopted with missing Table/Dialog/Drawer primitives.
- **Recommended first sprint:** *Strategist Loop Closure + Design System Adoption Wave 1* (see
  `09_NEXT_SPRINT.md`), preceded by the small *Foundation Verification* sprint in `11_MASTER_TODO.md`.
