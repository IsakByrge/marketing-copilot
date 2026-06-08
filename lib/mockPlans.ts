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
        text: "Gasol ska alltid förvaras stående, ventilerat och skyddat från stark värme. Det är en enkel vana som gör stor skillnad.",
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
        text: "Med rätt hantering är gasol både enkelt och säkert att använda. Vi hjälper dig gärna om du är osäker.",
        cta: "Vi hjälper dig med påfyllning och råd.",
        image: "Kund som får hjälp med gasolflaska.",
      },
    ],
  },
  {
    id: "gasol-husbil",
    company: "Gasolfyllarna",
    focus: "Husbilen inför semestern",
    tags: ["Husbil", "Semester", "Påfyllning", "Trygg resa"],
    posts: [
      {
        title: "Dags att semesterkolla gasolen?",
        text: "Inför semestern är det smart att kontrollera gasolen i husbilen. Då slipper du onödiga stopp när resan väl börjar.",
        cta: "Kom förbi innan avresa så hjälper vi dig.",
        image: "Husbil redo för semester med somrig bakgrund.",
      },
      {
        title: "Gasolpåfyllning innan resan",
        text: "Ska du iväg med husbil eller husvagn? Se till att gasolen är fylld innan du rullar iväg.",
        cta: "Fyll på snabbt och enkelt hos oss.",
        image: "Person som förbereder husbil inför semester.",
      },
      {
        title: "Tryggare camping med rätt gasol",
        text: "Matlagning, värme och kylskåp i husbilen fungerar bättre när gasolen är kontrollerad och redo.",
        cta: "Vi hjälper dig att bli semesterklar.",
        image: "Campingplats med husbil och kvällssol.",
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
  {
    id: "webshop-camping",
    company: "Fritidsvaruhuset",
    focus: "Campingprodukter inför semestern",
    tags: ["Camping", "Semester", "Packning", "Webshop"],
    posts: [
      {
        title: "Packa smart inför campingsemestern",
        text: "Rätt utrustning gör campingresan enklare, bekvämare och roligare. Se över vad du saknar innan du åker.",
        cta: "Utforska campingfavoriter i webshopen.",
        image: "Campingutrustning snyggt packad på ett bord.",
      },
      {
        title: "Smarta prylar för livet utomhus",
        text: "Från praktiska tillbehör till bekväma lösningar – små produkter kan göra stor skillnad på resan.",
        cta: "Beställ online inför semestern.",
        image: "Fritidsprodukter ute i naturmiljö.",
      },
      {
        title: "Redo för nästa campingtur?",
        text: "Oavsett om du åker långt eller bara över helgen är det skönt att ha rätt saker med sig.",
        cta: "Se våra utvalda campingprodukter.",
        image: "Tält, stol och campingutrustning i kvällsljus.",
      },
    ],
  },
  {
    id: "webshop-grill",
    company: "Fritidsvaruhuset",
    focus: "Grill och uteliv",
    tags: ["Grill", "Sommarkvällar", "Tillbehör", "Inspiration"],
    posts: [
      {
        title: "Gör grillkvällen enklare",
        text: "Med rätt tillbehör blir grillningen både smidigare och roligare. Se över vad du behöver inför helgen.",
        cta: "Hitta grilltillbehör i webshopen.",
        image: "Grilltillbehör på ett bord utomhus.",
      },
      {
        title: "Sommarkvällar börjar ute",
        text: "Skapa en härligare uteplats med smarta produkter för matlagning, umgänge och avkoppling.",
        cta: "Se våra produkter för uteliv.",
        image: "Uteplats med grill och kvällssol.",
      },
      {
        title: "Helgens grillplaner?",
        text: "Nu är det rätt läge att fylla på med tillbehör inför grillning, camping och spontana middagar utomhus.",
        cta: "Beställ idag i webshopen.",
        image: "Mat och grillredskap redo inför grillkväll.",
      },
    ],
  },
];

export function getRandomPlan() {
  return plans[Math.floor(Math.random() * plans.length)];
}