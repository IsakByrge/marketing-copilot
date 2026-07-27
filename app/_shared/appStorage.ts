// ─────────────────────────────────────────────────────────────
// Central client-storage helper.
//
// On logout we must remove Marketing Copilot's OWN cached data so the
// next person on a shared machine cannot briefly see the previous
// user's plan/profile. This helper:
//   • touches ONLY keys under APP_STORAGE_PREFIX (all app keys use it),
//   • never calls Storage.clear() (which would nuke unrelated keys,
//     including the Supabase auth session under its own "sb-*" keys),
//   • is a no-op on the server and defensive if storage access throws.
//
// It deliberately does NOT touch the Supabase session — that stays owned
// by supabase.auth.signOut().
// ─────────────────────────────────────────────────────────────

/** Prefix every Marketing Copilot storage key shares. */
export const APP_STORAGE_PREFIX = "marketing-copilot-";

/** Minimal structural subset of the Web Storage API this helper needs.
 *  Both `localStorage` and `sessionStorage` satisfy it — and so can a
 *  plain fake in tests. */
export interface StorageLike {
  readonly length: number;
  key(index: number): string | null;
  removeItem(key: string): void;
}

/** Pure: from a list of keys, keep only the app-owned ones. Separated out
 *  so the ownership rule is trivially unit-testable without any Storage. */
export function appStorageKeysToClear(keys: readonly string[]): string[] {
  return keys.filter((k) => k.startsWith(APP_STORAGE_PREFIX));
}

/** Remove every app-owned key from a single storage. Snapshots keys first
 *  so live-index shifting during removal cannot skip entries. Exported for
 *  direct, DOM-free testing. */
export function clearAppStorageIn(storage: StorageLike): void {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k !== null) keys.push(k);
  }
  for (const k of appStorageKeysToClear(keys)) storage.removeItem(k);
}

/** Clear Marketing Copilot's own localStorage + sessionStorage entries.
 *  Safe on the server (no-op) and if storage access throws (e.g. privacy
 *  mode / disabled storage). */
export function clearAppStorage(): void {
  if (typeof window === "undefined") return;
  try { clearAppStorageIn(window.localStorage); } catch { /* storage unavailable */ }
  try { clearAppStorageIn(window.sessionStorage); } catch { /* storage unavailable */ }
}
