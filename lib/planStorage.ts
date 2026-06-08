export function getSavedPlan() {
  if (typeof window === "undefined") return null;

  const savedPlan = localStorage.getItem("marketing-copilot-plan");

  if (!savedPlan) return null;

  try {
    return JSON.parse(savedPlan);
  } catch {
    return null;
  }
}