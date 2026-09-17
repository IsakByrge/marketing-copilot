// Deterministic, DOM-free test for the logout storage-clear helper.
// Run: npm run test:storage  (tsx app/_shared/appStorage.test.mts)
import {
  APP_STORAGE_PREFIX,
  appStorageKeysToClear,
  clearAppStorageIn,
  type StorageLike,
} from "./appStorage";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) { failures++; console.error(`  ✗ ${msg}`); }
  else console.log(`  ✓ ${msg}`);
}

// A plain in-memory fake that satisfies StorageLike.
class FakeStorage implements StorageLike {
  private m = new Map<string, string>();
  seed(k: string, v = "x") { this.m.set(k, v); }
  get length() { return this.m.size; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  has(k: string) { return this.m.has(k); }
}

// 1. Pure selector keeps only prefixed keys.
{
  const keys = [
    `${APP_STORAGE_PREFIX}plan`,
    `${APP_STORAGE_PREFIX}company-profile`,
    "sb-access-token",
    "unrelated",
  ];
  const out = appStorageKeysToClear(keys);
  assert(out.length === 2, "selector returns exactly the app-owned keys");
  assert(out.every((k) => k.startsWith(APP_STORAGE_PREFIX)), "selector keeps only prefixed keys");
}

// 2. clearAppStorageIn removes ALL app keys and NOTHING else.
{
  const s = new FakeStorage();
  s.seed(`${APP_STORAGE_PREFIX}plan`);
  s.seed(`${APP_STORAGE_PREFIX}company-profile`);
  s.seed(`${APP_STORAGE_PREFIX}company-input`);
  s.seed(`${APP_STORAGE_PREFIX}brain-files`);
  s.seed(`${APP_STORAGE_PREFIX}rhythm`);
  s.seed("sb-access-token");        // Supabase session — must survive
  s.seed("some-third-party-key");   // unrelated — must survive

  clearAppStorageIn(s);

  assert(!s.has(`${APP_STORAGE_PREFIX}plan`), "removes marketing-copilot-plan");
  assert(!s.has(`${APP_STORAGE_PREFIX}rhythm`), "removes marketing-copilot-rhythm");
  assert(
    ![...["plan", "company-profile", "company-input", "brain-files", "rhythm"]]
      .some((k) => s.has(`${APP_STORAGE_PREFIX}${k}`)),
    "removes every app-owned key",
  );
  assert(s.has("sb-access-token"), "preserves the Supabase auth key (sb-*)");
  assert(s.has("some-third-party-key"), "preserves unrelated third-party keys");
}

// 3. Empty / no-app-keys storage is untouched and safe.
{
  const s = new FakeStorage();
  s.seed("sb-refresh-token");
  clearAppStorageIn(s);
  assert(s.has("sb-refresh-token") && s.length === 1, "no-op when there are no app keys");
}

if (failures > 0) {
  console.error(`\n✗ appStorage: ${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log("\n✓ appStorage: all assertions passed.");
