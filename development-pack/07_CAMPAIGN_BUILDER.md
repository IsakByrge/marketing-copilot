# 07 — Campaign Builder / Marketing Strategist

`/campaign-builder` hosts **Marketing Strategist 2.0**, a 4-phase flow that turns a short brief into
a structured strategy recommendation. Its downstream is the **Facebook Specialist**
(`/content/facebook`), which turns a strategy into an actual Facebook post.

> **Terminology:** the v1 "Campaign Builder" (conversational interview) has been **replaced** by the
> v2 Marketing Strategist. The v1 modules and its two API routes still exist as dead code.

## Interview / phase flow (`app/campaign-builder/page.tsx`)

| Phase | Name | What happens | Backend |
|---|---|---|---|
| 1 | **Brief** | Compact form (product, goal, offer, period, geography, free text), prefilled from Company Brain. Goals from `lib/strategist/goals.ts`. | — (client) |
| 2 | **Analysis** | Real model call. Returns `campaignDiagnosis`, `recommendedFocus`, `rationale[]`, `identifiedGaps[]`, `alternativeDirections[]`, `confidence`. | `POST /api/strategist/analyze` |
| 3 | **Adaptive follow-ups** | 0–4 questions with `answerType` (text/single_select/multi_select), `reason`, `strategicImpact`, `relatedField`. Deterministic validation dedupes, enforces widget/options consistency, drops questions about already-known stable facts, max one question per strategy field. | (validated in `validate.ts`) |
| 4 | **Recommendation** | `StrategyCore`: `primaryGoal`, `primaryAudience`, `mainMessage`, `valueProposition`, `primaryCta`, `urgency`, `channelPriority[]` (with rationale), `risks[]`, `improvementOpportunities[]`, `kpis[]`, `assumptions[]`, plus `companyBrainReferences[]` for traceability. | `POST /api/strategist/recommend` |

## The strategist engine (`lib/strategist/`)

| File | Responsibility |
|---|---|
| `types.ts` | `StrategyV2`, `StrategyCore`, `StrategyAnalysis`, follow-ups (`STRATEGY_VERSION = 2`) |
| `prompts.ts` | `ANALYZE_SYSTEM`, `RECOMMEND_SYSTEM`, `companyBrainBlock()`, `briefBlock()`, user builders |
| `model.ts` | `callJson()`, `STRATEGIST_MODEL` (def `gpt-4o`), `STRATEGIST_TIMEOUT_MS` (45 s) |
| `validate.ts` | `coerceAnalyze`, `coerceRecommend`, `MAX_FOLLOWUPS = 4` — deterministic coercion + hard-issue detection |
| `request.ts` | `parseBrief`, `parseAnswers`, `parseAnalysis` — reject bad input with 400 before any model call |
| `companyContext.ts` | `buildStrategistCompanyContext()` — server-side, derives company from session |
| `adapter.ts` | `isStrategyV2`, `normalizeStrategyContext` — normalises v1 + v2 strategies to one shape |
| `goals.ts` | `STRATEGIST_GOALS`, `CAMPAIGN_GOALS`, `GOAL_TITLES` |
| `strategist.test.mts` | 17 assertions over mapping / validation / decision tree |

## Strategist ↔ Specialist ("specialists")

There is currently **one downstream specialist: Facebook** (`lib/facebook/`).

- **Draft → Review → max one Revision** (max 3 model calls). Draft `gpt-4o`, review `gpt-4o-mini`.
- **Deterministic gate** for critically missing info returns a single follow-up (`{type:"blocked"}`)
  instead of guessing.
- **Quality checks** (`lib/facebook/quality.ts`): cliché detection, fabricated-social-proof
  detection, alternative dedupe, length ranges, user-status derivation.
- **NDJSON-streamed** honest process phases to the client.
- **Prefill** (`lib/facebook/strategyPrefill.ts`): `mapStrategyToPrefill()` fills the Facebook brief
  from a saved strategy (v1 or v2 via the adapter).

## Generation flow (end to end)

```
/campaign-builder
  Phase 1 brief
    └─▶ POST /api/strategist/analyze  ──▶ analysis + 0–4 follow-ups
          └─▶ (user answers)
                └─▶ POST /api/strategist/recommend ──▶ StrategyV2
                      └─▶ saveStrategyV2() ──▶ campaign_strategies (strategy_context jsonb)
                            └─▶ direct link ──▶ /content/facebook?strategy=<id>
                                  └─▶ prefilled brief
                                        └─▶ POST /api/content/facebook ──▶ draft→review→revision
                                              └─▶ content_drafts (jsonb)
```

## Validation & safety (the "modern" bar)

1. `response_format: { type: "json_object" }` forces JSON.
2. Structural request parsing (`request.ts`) → 400 before any model call.
3. Deterministic coercion (`validate.ts`): trim, clamp to max length, cap list sizes, force enums.
4. Distinction between **safe transforms** (silent, logged as `notes`) and **hard issues**
   (`hardIssues`) that require action.
5. **Exactly one repair** on hard issues (same system prompt + explicit error description, lower
   temperature). Still failing → **502 with an honest message**. No silent fallback to generic text.
6. Checks against the company's `forbiddenClaims` and unverified social-proof regex patterns.

## Storage

`saveStrategyV2()` writes the whole `StrategyV2` to `campaign_strategies.strategy_context` (same
column as v1 — the adapter reads either format). See `08_TECH_DEBT.md` / `10_BLOCKERS.md` for the
consequences of the mixed column format.

## Current implementation status

- ✅ **Nothing in the strategy flow is mocked** — all four phases make real model calls.
- ✅ Deterministic validation, controlled repair, honest errors, server-derived identity, and (post
  security sprint) rate-limit + usage logging on both strategist routes.
- Intentionally hardcoded: default model `gpt-4o`, 45 s timeout, `MAX_FOLLOWUPS = 4`, temperatures
  0.5 / 0.3 (repair), all text length limits.

## Missing parts

1. **No way back to a saved strategy** — `campaign_strategies` has no list/detail view; `/campaigns`
   still shows only old plan campaign ideas. The only path back is the post-generation direct link.
2. **No editing / no versioning** — every run inserts a new row; no "revise this strategy".
3. **No budget/economics** — `StrategyCore` has no budget, channel spend, or reach estimate.
4. **No measurement** — `kpis[]` are generated but never measured or fed back.
5. **Only Facebook downstream** — other channels in `channelPriority` lead nowhere.
6. **No in-progress session persistence** — reloading `/campaign-builder` mid-flow loses brief,
   analysis and answers (all React state).
7. **Swedish-only regex** for social proof / clichés — English phrasings pass through.
8. **Dead v1 remnants** — `config.tsx`, `reasoning.ts`, `goal-profiles.ts`, `analysis.ts`,
   `/api/campaign-analysis`, `/api/campaign-interview`, `saveCampaignStrategy()`.
