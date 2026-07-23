export let generatedPlan: unknown = null;

export function setGeneratedPlan(plan: unknown) {
  generatedPlan = plan;
}

export function getGeneratedPlan() {
  return generatedPlan;
}