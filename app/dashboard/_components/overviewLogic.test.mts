// Deterministic, dependency-free test for the Overview derivation logic.
// Run: tsx app/dashboard/_components/overviewLogic.test.mts
import {
  recommendations,
  briefSummary,
  MAX_RECOMMENDATIONS,
  type OverviewState,
} from "./overviewLogic";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) { failures++; console.error(`  ✗ ${msg}`); }
  else console.log(`  ✓ ${msg}`);
}

const base: OverviewState = {
  hasCompany: true,
  companyName: "Isaks Bygg",
  brainLevel: "strong",
  gapCount: 0,
  hasPlan: true,
  opportunities: [],
};

// 1. No company → single onboarding recommendation, nothing else.
{
  const r = recommendations({ ...base, hasCompany: false });
  assert(r.length === 1 && r[0].kind === "onboarding", "no company → only onboarding");
  assert(briefSummary({ ...base, hasCompany: false }).includes("onboarding"), "brief points to onboarding");
}

// 2. Basic brain leads the stack.
{
  const r = recommendations({ ...base, brainLevel: "basic", hasPlan: false });
  assert(r[0].kind === "brain", "basic brain is the top recommendation");
  assert(r.some((x) => x.kind === "plan"), "missing plan is also recommended");
  assert(r.length <= MAX_RECOMMENDATIONS, "never exceeds the max");
}

// 3. Useful brain with gaps surfaces a gap-fill item with the real count.
{
  const r = recommendations({ ...base, brainLevel: "useful", gapCount: 2 });
  const brain = r.find((x) => x.kind === "brain");
  assert(!!brain && brain.title.includes("2"), "gap count is reflected honestly in the title");
}

// 4. Strong brain + plan + no opportunities → baseline strategy step (never empty).
{
  const r = recommendations(base);
  assert(r.length >= 1, "stack is never empty");
  assert(r[r.length - 1].kind === "strategy", "baseline strategy step is present");
}

// 5. Real opportunities become recommendations, capped at the max.
{
  const opportunities = [
    { title: "Vårkampanj", relevance: "Efterfrågan ökar i mars." },
    { title: "Nyhetsbrev", relevance: "Lista redo att aktiveras." },
    { title: "Extra", relevance: "..." },
    { title: "Extra 2", relevance: "..." },
  ];
  const r = recommendations({ ...base, opportunities });
  assert(r.length === MAX_RECOMMENDATIONS, "sliced to the max");
  assert(r[0].kind === "opportunity" && r[0].title.includes("Vårkampanj"), "top opportunity surfaced");
}

// 6. Generate-plan is a client action, not a link.
{
  const r = recommendations({ ...base, hasPlan: false, brainLevel: "strong" });
  const plan = r.find((x) => x.kind === "plan");
  assert(!!plan && plan.action === "generate-plan" && !plan.href, "plan item uses an action, not href");
}

// 7. Brief summary counts real recommendations.
{
  const s = briefSummary(base);
  assert(/\d+ rekommendation/.test(s), "brief reports a real recommendation count");
}

if (failures > 0) {
  console.error(`\n✗ overviewLogic: ${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log("\n✓ overviewLogic: all assertions passed.");
