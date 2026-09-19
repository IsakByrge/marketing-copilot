// ─────────────────────────────────────────────────────────────
// robots.txt: tolkning och uppslagning.
//
// Vi hämtar butikens egna produktsidor för att ha underlag att skriva
// ifrån. Att det är kundens egen sajt gör inte robots.txt frivillig —
// den kan mycket väl stänga av /sok eller /checkout, och en robot som
// struntar i den blir en robot man blockerar.
//
// Ren logik, inga beroenden mot nätverket. Testas i lib/productText/source.test.mts.
// ─────────────────────────────────────────────────────────────

export interface RobotsRules {
  /** Allow-mönster som gäller vår user-agent. */
  allow: string[];
  /** Disallow-mönster som gäller vår user-agent. */
  disallow: string[];
  /** Crawl-delay i millisekunder om sajten begärt en, annars null. */
  crawlDelayMs: number | null;
}

export const EMPTY_RULES: RobotsRules = { allow: [], disallow: [], crawlDelayMs: null };

/**
 * Tolkar robots.txt. Ett block för vår egen user-agent vinner över `*`;
 * finns inget av dem gäller inga regler.
 *
 * Tolkningen är medvetet snäll mot sajten och sträng mot oss: kan vi inte
 * tolka filen låter vi bli att hämta, i stället för att anta att allt är
 * tillåtet.
 */
export function parseRobots(text: string, agent: string): RobotsRules {
  const wanted = agent.toLowerCase();
  const groups = new Map<string, RobotsRules>();
  let current: string[] = [];
  // Flera User-agent-rader i följd delar samma regelblock.
  let expectingAgents = false;

  for (const rawLine of (text ?? "").split(/\r?\n/)) {
    const line = rawLine.split("#")[0].trim();
    if (!line) continue;
    const at = line.indexOf(":");
    if (at === -1) continue;
    const field = line.slice(0, at).trim().toLowerCase();
    const value = line.slice(at + 1).trim();

    if (field === "user-agent") {
      if (!expectingAgents) current = [];
      expectingAgents = true;
      const key = value.toLowerCase();
      current.push(key);
      if (!groups.has(key)) groups.set(key, { allow: [], disallow: [], crawlDelayMs: null });
      continue;
    }

    expectingAgents = false;
    for (const key of current) {
      const rules = groups.get(key);
      if (!rules) continue;
      if (field === "allow" && value) rules.allow.push(value);
      else if (field === "disallow") {
        // "Disallow:" utan värde betyder uttryckligen "inget är förbjudet".
        if (value) rules.disallow.push(value);
      } else if (field === "crawl-delay") {
        const seconds = Number(value.replace(",", "."));
        if (Number.isFinite(seconds) && seconds > 0) {
          rules.crawlDelayMs = Math.min(seconds * 1000, 30_000);
        }
      }
    }
  }

  return groups.get(wanted) ?? groups.get("*") ?? EMPTY_RULES;
}

/**
 * Omvandlar ett robots-mönster till ett reguljärt uttryck. `*` matchar
 * vad som helst, `$` binder till slutet, allt annat är bokstavligt.
 */
function toPattern(rule: string): RegExp {
  const anchored = rule.endsWith("$");
  const body = anchored ? rule.slice(0, -1) : rule;
  const escaped = body
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  return new RegExp(`^${escaped}${anchored ? "$" : ""}`);
}

/** Längden på det längsta mönstret som matchar, eller -1. */
function longestMatch(rules: string[], path: string): number {
  let best = -1;
  for (const rule of rules) {
    if (toPattern(rule).test(path)) best = Math.max(best, rule.length);
  }
  return best;
}

/**
 * Sant när sökvägen får hämtas. Vid konflikt vinner det längsta
 * mönstret, och Allow vinner vid lika längd — samma regel som Google och
 * de flesta andra följer.
 */
export function isAllowed(rules: RobotsRules, path: string): boolean {
  const p = path || "/";
  const allow = longestMatch(rules.allow, p);
  const disallow = longestMatch(rules.disallow, p);
  if (disallow === -1) return true;
  return allow >= disallow;
}
