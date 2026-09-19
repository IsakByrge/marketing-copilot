// ─────────────────────────────────────────────────────────────
// Där arbetspasset ligger: IndexedDB i din webbläsare.
//
// 601 artiklar är flera timmars arbete. Låg allt i minnet skulle en
// omladdning nollställa dagen. Samtidigt finns ingen anledning att lägga
// en kunds hela produktkatalog i vår databas för att skriva texter.
// IndexedDB löser båda: filen lämnar aldrig datorn, och passet överlever
// att du stänger fliken.
//
// Priset är att passet hör till EN webbläsare på EN dator, och försvinner
// om du rensar webbplatsdata. Därför säger gränssnittet det rakt ut.
//
// Nyckeln ligger under samma prefix som allt annat appen sparar, så att
// utloggning kan städa den (se app/_shared/appStorage.ts).
// ─────────────────────────────────────────────────────────────
import { APP_STORAGE_PREFIX } from "@/app/_shared/appStorage";
import type { Session } from "@/lib/productText/session";

const DB_NAME = `${APP_STORAGE_PREFIX}product-texts`;
const STORE = "sessions";
/** Ett pass i taget. Fler samtidiga kataloger löser inget problem vi har. */
const KEY = "current";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Sant när webbläsaren kan spara passet. Privat läge kan säga nej. */
export const canPersist = (): boolean =>
  typeof indexedDB !== "undefined";

/**
 * Läser passet. Returnerar `null` både när inget finns och när lagringen
 * inte går att nå — sidan ska fungera ändå, bara utan att komma ihåg.
 */
export async function loadSession(): Promise<Session | null> {
  if (!canPersist()) return null;
  try {
    const db = await open();
    const value = await new Promise<unknown>((resolve, reject) => {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return isSession(value) ? value : null;
  } catch {
    return null;
  }
}

/** Skriver passet. Fel sväljs: ett misslyckat sparande får aldrig stoppa arbetet. */
export async function saveSession(session: Session): Promise<boolean> {
  if (!canPersist()) return false;
  try {
    const db = await open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(session, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
    return true;
  } catch {
    return false;
  }
}

/** Kastar passet — "Börja om med en annan fil". */
export async function clearSession(): Promise<void> {
  if (!canPersist()) return;
  try {
    const db = await open();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    db.close();
  } catch {
    // Inget att göra: passet är ändå på väg bort ur gränssnittet.
  }
}

/** Grundkontroll av det som låg i lagringen, som kan vara från en äldre version. */
function isSession(value: unknown): value is Session {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.fileName === "string" &&
    Array.isArray(o.headers) &&
    Array.isArray(o.rows) &&
    typeof o.cols === "object" &&
    o.cols !== null &&
    typeof o.items === "object" &&
    o.items !== null
  );
}
