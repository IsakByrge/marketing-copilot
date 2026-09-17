@AGENTS.md

# Marketing Copilot

Svenskspråkig AI-marknadsföringsassistent för svenska småföretag.
Next.js 16 · Supabase · OpenAI. Ensam utvecklare, 5–20 h/vecka.

**Läs `VISION.md` först.** Den gäller före alla andra dokument i repot och innehåller
positionering, kund, nuläge, designbeslut och sekvens.

## Så här ska du jobba

- Svara på svenska.
- Läs `node_modules/next/dist/docs/` innan du skriver Next-specifik kod. Den här
  versionen har brytande ändringar mot din träningsdata — gissa aldrig API-syntax.
- Prioritera alltid det som tar produkten närmare en riktig användare framför det som
  gör den finare.
- Säg ifrån när jag håller på att bygga något innan det finns någon som vill ha det.
  Jag har en tendens att designa om istället för att lansera.
- Föreslå inga nya styrdokument, sign-offs eller readiness-grindar. Det finns bara en
  person här. `VISION.md` uppdateras, den kompletteras inte.

## Regler för produkten

- **Visa aldrig en siffra som inte kan beläggas med data vi faktiskt har.** Ingen
  förtroendeprocent, ingen påhittad intäktspåverkan, ingen prognos utan underlag.
  Ärliga tomlägen är ett medvetet designbeslut.
- Rekommendationer före KPI:er. Alltid.
- Varje förslag ska kunna motiveras med användarens egna svar ur Company Brain.
- Mobil är huvudfallet.

## Läget just nu

Noll användare. Fas 0 i `ROADMAP_TILL_OS.md`: sex blockerare i
`FIRST_USERS_REVIEW.md` som hindrar att någon annan kan använda produkten.

## Kartan

| Fil | Innehåll |
|---|---|
| `VISION.md` | Gäller före allt annat |
| `FIRST_USERS_REVIEW.md` | Vad som är trasigt före fem testanvändare |
| `ROADMAP_TILL_OS.md` | Sekvens från idag till full plattform |
| `design-forslag/index.html` | Designskisser |
| `development-pack/` | Teknisk revision, fortfarande korrekt |
| `docs/`, `SPRINT_REVIEW.md` m.fl. | Historik. Styr inte efter dem. |
| `fran-chatgpt/` | Källunderlag, konsoliderat i `VISION.md` |
