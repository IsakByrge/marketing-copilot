export const companies = [
  {
    name: "Gasolfyllarna",
    industry: "Gasol",
    focus: "Sommarens gasolsäsong",
  },
  {
    name: "Fritidsvaruhuset",
    industry: "Webshop",
    focus: "Sommarkampanj för fritidsprodukter",
  },
];

export const plans = [
  {
    id: "gasol-sommar",
    company: "Gasolfyllarna",
    focus: "Sommarens gasolsäsong",
    tags: ["Camping", "Grillning", "Husbil", "Säkerhet"],
    posts: [
      {
        title: "Är gasolflaskan redo för semestern?",
        text: "Innan du ger dig iväg med husbil eller husvagn är det klokt att kontrollera gasolen. En snabb kontroll kan göra resan tryggare.",
        cta: "Kom förbi oss innan avresa så hjälper vi dig.",
        image: "Husbil på camping med gasolflaska i förgrunden.",
      },
      {
        title: "5 tips för säker grillning",
        text: "Kontrollera slangar, kopplingar och gasolflaska innan du börjar grilla. Små kontroller gör stor skillnad.",
        cta: "Fyll på gasol hos oss inför helgen.",
        image: "Familj som grillar ute en ljus sommarkväll.",
      },
      {
        title: "Gasol till grill, camping och husbil",
        text: "Vi hjälper dig med gasolpåfyllning inför sommarens grillkvällar, campingresor och utflykter.",
        cta: "Välkommen in för snabb hjälp.",
        image: "Gasolflaskor i en ren butiksmiljö.",
      },
    ],
  },
  {
    id: "gasol-sakerhet",
    company: "Gasolfyllarna",
    focus: "Säker gasolhantering",
    tags: ["Trygghet", "Kontroll", "Service", "Rådgivning"],
    posts: [
      {
        title: "Så förvarar du gasol säkert",
        text: "Gasol ska alltid förvaras stående, ventilerat och skyddat från stark värme.",
        cta: "Fråga oss gärna om säker gasolförvaring.",
        image: "Trygg och ventilerad förvaring av gasolflaskor.",
      },
      {
        title: "När kontrollerade du slangen senast?",
        text: "En sliten slang kan vara svår att upptäcka. Kontrollera regelbundet och byt vid minsta osäkerhet.",
        cta: "Kom in så hjälper vi dig att kontrollera.",
        image: "Närbild på gasolslang och koppling.",
      },
      {
        title: "Tryggare gasol inför sommaren",
        text: "Med rätt hantering är gasol både enkelt och säkert att använda.",
        cta: "Vi hjälper dig med påfyllning och råd.",
        image: "Kund som får hjälp med gasolflaska.",
      },
    ],
  },
  {
    id: "webshop-sommar",
    company: "Fritidsvaruhuset",
    focus: "Sommarkampanj för fritidsprodukter",
    tags: ["Sommar", "Camping", "Uteliv", "Erbjudanden"],
    posts: [
      {
        title: "Gör dig redo för sommarens äventyr",
        text: "Nu är det hög tid att fylla på med smarta produkter för camping, grillning och lediga dagar utomhus.",
        cta: "Se sommarens utvalda produkter i webshopen.",
        image: "Sommarprodukter packade inför campingresa.",
      },
      {
        title: "Allt för helgens utflykt",
        text: "Små saker kan göra stor skillnad när du ska iväg. Se över utrustningen innan helgen.",
        cta: "Beställ enkelt online.",
        image: "Packad bil med fritidsprodukter.",
      },
      {
        title: "Sommarfavoriter i lager",
        text: "Vi har samlat produkter som passar perfekt för camping, grillning och spontana utflykter.",
        cta: "Handla online idag.",
        image: "Produkter för camping och fritid på ljus bakgrund.",
      },
    ],
  },
];

export function getRandomPlan() {
  return plans[Math.floor(Math.random() * plans.length)];
}