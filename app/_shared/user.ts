// ─────────────────────────────────────────────────────────────
// Små hjälpare för hur den inloggade personen visas.
//
// Låg tidigare i Shell.tsx. När den mörka Shell togs bort behövde
// dashboarden den fortfarande, och en hälsning har ingenting med
// navigation att göra — därför en egen fil.
// ─────────────────────────────────────────────────────────────

/** Bästa möjliga förnamn ur en e-postadress — ingen persondata utöver det som redan finns. */
export function firstNameFromEmail(email: string | null): string | null {
  if (!email) return null;
  const local = email.split("@")[0];
  if (!local) return null;
  const first = local.split(/[._\-+0-9]+/).filter(Boolean)[0];
  if (!first) return null;
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}
