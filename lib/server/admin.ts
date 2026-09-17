// ─────────────────────────────────────────────────────────────
// Vem som är administratör.
//
// Kostnadsvyn visar dollarbelopp, interna funktionsnamn och antal fel.
// Det är driftsdata för den som betalar OpenAI-fakturan, inte något en
// kund ska mötas av. Listan läses ur ADMIN_EMAILS (kommaseparerad) och
// kontrolleras ENBART på servern — en klientkontroll är en gardin, inte
// ett lås, eftersom vem som helst kan ändra den i webbläsaren.
//
// Saknas variabeln är ingen administratör. Det är med flit: en tom
// lista ska stänga vyn, inte öppna den för alla.
// ─────────────────────────────────────────────────────────────

/** Adresserna i ADMIN_EMAILS, normaliserade. Tom lista när variabeln saknas. */
export function adminEmails(raw = process.env.ADMIN_EMAILS): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Sant bara när adressen finns i listan. Jämförelsen struntar i versaler
 *  och mellanslag, eftersom e-postadresser inte är skiftlägeskänsliga i
 *  praktiken och listan skrivs för hand i en miljövariabel. */
export function isAdminEmail(email: string | null | undefined, raw = process.env.ADMIN_EMAILS): boolean {
  if (!email) return false;
  const normaliserad = email.trim().toLowerCase();
  if (!normaliserad) return false;
  return adminEmails(raw).includes(normaliserad);
}
