# 06 — Company Brain

The Company Brain is a structured, editable "company knowledge" store that feeds the AI features.
It is defined in `app/_shared/companyBrain.ts` and edited on `/company`.

## Current data model (`CompanyBrain`)

- `companySummary`, `primaryCustomers[]`, `strengths[]`, `uniqueSellingPoints[]`, `tone[]`
- `contentGuidelines[]`, `forbiddenClaims[]`, `preferredCallsToAction[]`
- `commonCustomerObjections[]`, `proofPoints[]` (verified social proof)
- `competitors[]` — `{ id, name, website?, notes?, source, confidence }`
- `products[]` — `{ id, name, category?, description?, customerProblem?, primaryAudience?,
  differentiators[], commonObjections[], profitability, priority, seasonality?, availabilityNotes?,
  source, confidence, confirmedAt?, updatedAt }`
- `keySeasons[]`, `marketingGoals[]`, `lastReviewedAt?`

**Provenance:** every product and competitor carries `source`
(`user_confirmed` | `website_extracted` | `campaign_learned` | `ai_suggested`) and `confidence`
(`low` | `medium` | `high`). Core principle in code: **the system never guesses that a fact is
true** — migrated/AI-derived data is never auto-promoted to `user_confirmed`.

## Storage

- A **single JSONB column** `companies.company_brain` (migration `0001`, `NOT NULL DEFAULT '{}'`).
  Deliberate MVP choice: the model is already structured at the application level; JSONB needs no new
  RLS policy (inherits the row's), no new foreign keys, no multi-table writes.
- Writes happen **client-side only** via `useCompanyBrain.save()` using the RLS-scoped browser
  client (no API route). The **old flat columns** (`summary`, `customers`, `products`, `tone`,
  `strengths`, `avoid`, `content_guidelines`) are never touched by Company Brain — they remain a
  backward-compatible fallback.
- `migrateProfileToBrain()` builds a compatible brain in memory when `company_brain` is missing or
  incomplete; an existing `company_brain` wins field-by-field.

## API

There is **no dedicated Company Brain API route** for writes — the client writes JSONB directly.
For **reads by the AI features**, `lib/companyBrainServer.ts::getCompanyBrainContext()` builds a
minimised, safe context **server-side from the session**. It is now wired into `create-content`
(and the strategist/facebook engines use their own `companyContext.ts`/`context.ts` builders).

Context sent to models never contains internal IDs, `source`/`confidence` metadata, or exact
financials — only profitability as a level (`low`/`normal`/`high`/`unknown`).

## UI

- `/company` — the Company Brain editor: products (profitability, priority, objections,
  differentiators), competitors, audiences, tone, content rules, forbidden claims, verified social
  proof, seasons. Shows a deterministic knowledge level (basic/useful/strong) and the top three
  knowledge gaps as concrete questions.
- `/onboarding` — scrapes the company website and proposes a marketing profile (populates the flat
  profile, not the brain directly).
- `/profile` — a **legacy** page that also edits company data (file uploads) and **functionally
  overlaps `/company`**.

## Who consumes it

| Consumer | Path | What is sent |
|---|---|---|
| **Marketing Strategist** | `lib/strategist/companyContext.ts` → `prompts.ts::companyBrainBlock()` | name, summary, up to 8 ranked products, strengths, USPs, seasons, competitor names, tone, proofPoints, forbiddenClaims |
| **Facebook Specialist** | `lib/facebook/context.ts` | minimised context + optional selected strategy via adapter |
| **`create-content`** | `lib/companyBrainServer.ts` | server-side minimised context |
| **Weekly plan / onboarding** | — | **Uses the OLD flat `CompanyProfile`, not the Company Brain** |

## Missing functionality

1. **Weekly plan, onboarding still use the old flat profile** — improvements in Company Brain do not
   reach the most-used feature (the weekly plan). `companyBrainServer` is now wired into
   `create-content` but not into `generate-plan`.
2. **No normalization** — products/competitors cannot be queried in SQL, sorted, or joined. No
   history/versioning.
3. **No automatic write-back** — knowledge gaps are shown but filled only manually; nothing writes
   learnings back from campaigns/content (`campaign_learned` source is reserved but unused).
4. **`website_extracted` source** is defined but not actively set in the migration path.
5. **Only one company per user** — every query does `order created_at desc limit 1`.

## Risks

| # | Risk | Severity |
|---|---|---|
| 1 | **Two parallel company models** (flat `CompanyProfile` vs Company Brain JSONB) — divergence, and the weekly plan silently ignores brain edits. | High (product) |
| 2 | **No server-side validation on write** — `sanitizeBrain()` runs only on **read**; a tampered client can store arbitrary JSON in `company_brain` (bounded by RLS to its own row). | Medium |
| 3 | **Provenance only partial** — most company-level fields (strengths, tone, audiences) carry no `source`/`confidence`; only products and competitors do. | Low |
| 4 | **JSONB is unqueryable** — no analytics, no cross-company insight, no migration safety net. | Low |
| 5 | **RLS on `companies` cannot be verified from the repo** — `0001` assumes it already exists (no baseline migration). | Medium |
