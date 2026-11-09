import type { BlockDef, BlockData, FieldDef, PageDef } from "./types";

// De pagina's van de publieke site met hun blokken, velden en standaardteksten.
// Dit is de bron van de teksten: het CMS bewaart alleen afwijkingen hiervan.
// Teksten mogen tokens bevatten die uit Site-instellingen komen:
//   {sites} {plaatsingen} {prijsBlog} {prijsHomepage} {email} {landen} {uren}

const text = (key: string, label: string, help?: string): FieldDef => ({ key, label, type: "text", help });
const area = (key: string, label: string, help?: string): FieldDef => ({ key, label, type: "textarea", help });
const tags = (key: string, label: string, help?: string): FieldDef => ({ key, label, type: "tags", help });
const link = (key: string, label: string): FieldDef => ({ key, label, type: "link" });
const bool = (key: string, label: string, help?: string): FieldDef => ({ key, label, type: "bool", help });
const items = (key: string, label: string, itemLabel: string, itemFields: FieldDef[], help?: string): FieldDef => ({
  key,
  label,
  type: "items",
  itemLabel,
  itemFields,
  help,
});

const block = <D extends BlockData>(label: string, fields: FieldDef[], defaults: D): BlockDef<D> => ({ label, fields, defaults });
const definePage = <B extends Record<string, BlockDef>>(p: PageDef<B>): PageDef<B> => p;

const heading = [text("eyebrow", "Klein label boven de kop"), text("title", "Kop")];
const faqBlock = (eyebrow: string, title: string, list: { q: string; a: string }[]) =>
  block("Veelgestelde vragen", [...heading, items("items", "Vragen", "Vraag", [text("q", "Vraag"), area("a", "Antwoord")])], {
    eyebrow,
    title,
    items: list,
  });

// ---------------------------------------------------------------- instellingen

export const settingsPage = definePage({
  slug: "_instellingen",
  title: "Site-instellingen",
  path: "",
  canUnpublish: false,
  isPage: false,
  seo: { title: "", description: "", keyword: "" },
  blocks: {
    cijfers: block(
      "Cijfers",
      [
        text("siteCount", "Aantal sites", "Token {sites}. Bijvoorbeeld 500+."),
        text("placementCount", "Aantal plaatsingen", "Token {plaatsingen}."),
        text("priceBlogFrom", "Bloglink vanaf (€, excl. btw)", "Token {prijsBlog}. Alleen het getal."),
        text("priceHomepageFrom", "Homepagelink vanaf (€ per jaar)", "Token {prijsHomepage}. Alleen het getal."),
      ],
      { siteCount: "500+", placementCount: "20.000+", priceBlogFrom: "35", priceHomepageFrom: "67" }
    ),
    contact: block(
      "Contactgegevens",
      [
        text("contactEmail", "E-mailadres", "Token {email}. Ook het adres waar het contactformulier heen gaat als er geen admins zijn."),
        text("hours", "Bereikbaar", "Token {uren}."),
        text("countries", "Werkgebied", "Token {landen}."),
      ],
      { contactEmail: "info@publito.nl", hours: "Werkdagen van 9:00 tot 17:00", countries: "Nederland en België" }
    ),
    prijskaarten: block(
      "Prijskaarten",
      [
        items(
          "cards",
          "Kaarten",
          "Kaart",
          [
            text("badge", "Label"),
            text("title", "Naam"),
            text("price", "Prijs", "Bijvoorbeeld {prijsBlog}."),
            text("unit", "Onder de prijs"),
            tags("points", "Voordelen"),
            link("cta", "Knop"),
            bool("featured", "Uitgelicht", "Krijgt een donkere rand en een groene knop."),
          ],
          "Staan op de homepage en op de pagina Prijzen."
        ),
        text("note", "Regel onder de kaarten"),
      ],
      {
        cards: [
          {
            badge: "Meest gekozen",
            title: "Bloglink",
            price: "{prijsBlog}",
            unit: "vanaf · permanent",
            points: ["Redactioneel artikel met jouw link", "Tekst + afbeelding inbegrepen", "Blijft permanent online"],
            cta: { label: "Bekijk bloglinks", href: "/register" },
            featured: true,
          },
          {
            badge: "Sterkste signaal",
            title: "Homepagelink",
            price: "{prijsHomepage}",
            unit: "vanaf · per jaar",
            points: ["Jouw link direct op de voorpagina", "Op sterke, relevante domeinen", "Jaarlijks verlengbaar"],
            cta: { label: "Bekijk homepagelinks", href: "/register" },
            featured: false,
          },
        ],
        note: "Alle prijzen zijn exclusief btw.",
      }
    ),
  },
});

// ---------------------------------------------------------------- homepage

export const homePage = definePage({
  slug: "home",
  title: "Homepage",
  path: "/",
  canUnpublish: false,
  isPage: true,
  seo: {
    title: "Publito — Backlinks direct bij de bron",
    description:
      "Backlinks op gecontroleerde sites met echte bezoekers. Direct bij de bron, transparante cijfers en het artikel inbegrepen.",
    keyword: "backlinks kopen",
  },
  blocks: {
    hero: block(
      "Hero",
      [
        tags("chips", "Kleine labels"),
        text("title1", "Kop · regel 1"),
        text("title2", "Kop · regel 2 (gemarkeerd)"),
        area("intro", "Introtekst"),
        link("button1", "Knop 1"),
        link("button2", "Knop 2"),
        items("stats", "Cijfers onder de knoppen", "Cijfer", [text("value", "Waarde"), text("label", "Omschrijving")]),
      ],
      {
        chips: ["{sites} sites", "NL · BE", "Content inbegrepen"],
        title1: "Google vindt je.",
        title2: "AI noemt je.",
        intro:
          "Backlinks op gecontroleerde sites met echte bezoekers — zodat zoekmachines én AI‑assistenten jouw merk kennen. Artikel inbegrepen, direct bij de bron.",
        button1: { label: "Bekijk {sites} sites", href: "/register" },
        button2: { label: "Gratis linkbuilding‑analyse", href: "/contact" },
        stats: [
          { value: "{sites}", label: "sites" },
          { value: "{plaatsingen}", label: "plaatsingen" },
          { value: "€ {prijsBlog}", label: "vanaf · incl. content" },
        ],
      }
    ),
    usps: block(
      "USP's",
      [
        ...heading,
        items("items", "Kaarten", "Kaart", [text("title", "Titel"), area("text", "Tekst"), bool("highlight", "Uitgelicht (zandkleur)")]),
      ],
      {
        eyebrow: "Kies, bestel, live",
        title: "Zo maken we linkbuilding simpel.",
        items: [
          {
            title: "Kies uit {sites} sites",
            text: "Filter op niche, DR, verkeer en prijs. Alles vooraf zichtbaar, geen verrassingen achteraf.",
            highlight: false,
          },
          {
            title: "Bestel op rekening",
            text: "Voor bureaus: één verzamelfactuur per maand, geen betaling op het moment zelf.",
            highlight: true,
          },
          {
            title: "Artikel inbegrepen",
            text: "Lever zelf aan of laat ons een redactioneel artikel schrijven, met afbeelding.",
            highlight: false,
          },
          { title: "Snel geplaatst", text: "Status per plaatsing in je dashboard, van bestelling tot live.", highlight: false },
        ],
      }
    ),
    steps: block(
      "Zo werkt het",
      [
        ...heading,
        items(
          "items",
          "Stappen",
          "Stap",
          [text("label", "Label"), text("title", "Titel"), area("text", "Tekst")],
          "De eerste drie stappen tonen een schermafbeelding van het platform."
        ),
      ],
      {
        eyebrow: "Zo werkt het",
        title: "Drie stappen. Eén dashboard.",
        items: [
          { label: "01 — Selecteren", title: "Kies je sites", text: "Niche, DR, verkeer en prijs per site." },
          { label: "02 — Invullen", title: "Lever je inhoud", text: "Eigen tekst, Google Doc, of wij schrijven." },
          { label: "03 — Bevestigen", title: "Bevestig en volg", text: "Op rekening of direct. Live‑status per link." },
        ],
      }
    ),
    compare: block(
      "Vergelijking",
      [
        ...heading,
        text("goodLabel", "Goede kant · label"),
        text("goodTitle", "Goede kant · titel"),
        tags("goodPoints", "Goede kant · punten"),
        text("badLabel", "Andere kant · label"),
        text("badTitle", "Andere kant · titel"),
        tags("badPoints", "Andere kant · punten"),
      ],
      {
        eyebrow: "Geen reseller",
        title: "Waarom je beter direct bij de bron bestelt.",
        goodLabel: "Publito",
        goodTitle: "Direct bij de website",
        goodPoints: [
          "Gecontroleerde sites met eigen bezoekers",
          "DR, verkeer en niche vooraf zichtbaar",
          "Uniek artikel, geschreven voor die publisher",
          "Prijs per site, geen marge van een tussenpersoon",
        ],
        badLabel: "Reseller / linkfarm",
        badTitle: "Via een tussenlaag",
        badPoints: [
          "Onbekend waar je link komt te staan",
          "Opgeblazen metrics, nauwelijks bezoekers",
          "Gespinde of gekopieerde content",
          "Marge op marge, zonder inzicht",
        ],
      }
    ),
    prices: block(
      "Prijzen",
      [...heading, area("intro", "Introtekst", "De prijskaarten zelf pas je aan in Site-instellingen.")],
      {
        eyebrow: "Prijzen",
        title: "Eerlijke prijzen, per plaatsing.",
        intro: "Geen abonnement, geen setupkosten. Het artikel zit erbij.",
      }
    ),
    faq: faqBlock("FAQ", "Veelgestelde vragen", [
      {
        q: "Moet ik zelf de content schrijven?",
        a: "Nee. Wij schrijven standaard een redactioneel artikel met afbeelding, zonder extra kosten. Zelf aanleveren (tekst of Google Doc) kan ook.",
      },
      {
        q: "Zijn dit echte sites met bezoekers?",
        a: "Ja. Elke site in de marktplaats is gecontroleerd op echt verkeer, een eigen redactie en een natuurlijk linkprofiel. Sites die niet (meer) voldoen, halen we eruit.",
      },
      {
        q: "Hoe snel staat mijn link live?",
        a: "De meeste plaatsingen staan binnen enkele werkdagen online. Je volgt de status per link in je dashboard en krijgt bericht zodra het artikel live staat.",
      },
      {
        q: "Kan ik op rekening bestellen?",
        a: "Ja. Bureaus en vaste klanten kunnen op rekening bestellen en ontvangen één verzamelfactuur per maand. Direct betalen kan natuurlijk ook.",
      },
      {
        q: "Wat is het verschil tussen een bloglink en een homepagelink?",
        a: "Een bloglink is een artikel met jouw link dat permanent online blijft. Een homepagelink staat op de voorpagina van de site en wordt per jaar afgenomen.",
      },
    ]),
  },
});

// ---------------------------------------------------------------- prijzen

export const pricesPage = definePage({
  slug: "prijzen",
  title: "Prijzen",
  path: "/prijzen",
  canUnpublish: true,
  isPage: true,
  seo: {
    title: "Prijzen voor backlinks, per plaatsing · Publito",
    description:
      "Transparante prijzen per plaatsing. Bloglinks vanaf € 35 (permanent), homepagelinks vanaf € 67 per jaar. Artikel inbegrepen, geen abonnement.",
    keyword: "backlinks prijzen",
  },
  blocks: {
    header: block("Kop van de pagina", [...heading, area("intro", "Introtekst")], {
      eyebrow: "Prijzen",
      title: "Betaal per plaatsing. Niets meer.",
      intro:
        "Geen abonnement, geen setupkosten, geen verborgen marge. Je ziet per site wat een link kost en het artikel zit erbij.",
    }),
    cards: block("Prijskaarten", [], {}),
    included: block(
      "Wat je altijd krijgt",
      [...heading, items("items", "Kaarten", "Kaart", [text("title", "Titel"), area("text", "Tekst")])],
      {
        eyebrow: "Inbegrepen",
        title: "Wat je altijd krijgt.",
        items: [
          { title: "Redactioneel artikel", text: "Uniek geschreven voor de publisher, inclusief afbeelding. Of lever je eigen tekst aan." },
          { title: "Plaatsing en controle", text: "Wij regelen de plaatsing en controleren of de link correct en dofollow live staat." },
          { title: "Dashboard en rapportage", text: "Elke link met status, URL en datum op één plek. Exporteer wanneer je wilt." },
          { title: "Op rekening voor bureaus", text: "Eén verzamelfactuur per maand, zodat je niet per bestelling hoeft af te rekenen." },
        ],
      }
    ),
    faq: faqBlock("FAQ", "Vragen over prijzen", [
      {
        q: "Waarom verschillen de prijzen per site?",
        a: "Elke publisher bepaalt zijn eigen prijs, op basis van autoriteit, verkeer en niche. In de marktplaats zie je per site precies wat een plaatsing kost — vóór je bestelt.",
      },
      {
        q: "Zijn er abonnements- of setupkosten?",
        a: "Nee. Je betaalt per plaatsing. Een account is gratis en je bekijkt het volledige aanbod zonder verplichtingen.",
      },
      {
        q: "Wat gebeurt er als een link offline gaat?",
        a: "Bloglinks blijven permanent staan. Verdwijnt een link toch, dan plaatsen we deze opnieuw of krijg je je geld terug.",
      },
      {
        q: "Krijgen bureaus korting?",
        a: "Bureaus met vaste afname krijgen een eigen tarief en kunnen op rekening bestellen. Neem contact op voor de mogelijkheden.",
      },
    ]),
  },
});

// ---------------------------------------------------------------- uitbesteden

export const outsourcePage = definePage({
  slug: "uitbesteden",
  title: "Uitbesteden",
  path: "/uitbesteden",
  canUnpublish: true,
  isPage: true,
  seo: {
    title: "Linkbuilding uitbesteden · Publito",
    description:
      "Geen tijd om zelf sites te kiezen? Wij stellen een linkplan op, schrijven de artikelen en plaatsen de links. Jij ziet alles in je dashboard.",
    keyword: "linkbuilding uitbesteden",
  },
  blocks: {
    hero: block(
      "Hero",
      [
        tags("chips", "Kleine labels"),
        text("title", "Kop"),
        area("intro", "Introtekst"),
        link("button1", "Knop 1"),
        link("button2", "Knop 2"),
        text("cardLabel", "Kaart · label"),
        tags("cardPoints", "Kaart · punten"),
      ],
      {
        chips: ["Linkplan op maat", "Artikelen inbegrepen", "Maandelijkse rapportage"],
        title: "Laat linkbuilding aan ons over.",
        intro:
          "Geen tijd om zelf sites te kiezen en teksten te laten schrijven? Wij stellen een linkplan op, schrijven de artikelen en plaatsen de links. Jij ziet alles terug in je dashboard.",
        button1: { label: "Gratis linkbuilding‑analyse", href: "/contact" },
        button2: { label: "Bekijk prijzen", href: "/prijzen" },
        cardLabel: "Wat je krijgt",
        cardPoints: [
          "Analyse van je site en concurrenten",
          "Linkplan met sites, ankerteksten en tempo",
          "Redactionele artikelen, geschreven door onze redactie",
          "Plaatsing en controle van elke link",
          "Maandelijkse rapportage in je dashboard",
        ],
      }
    ),
    steps: block(
      "Zo werkt het",
      [...heading, items("items", "Stappen", "Stap", [text("title", "Titel"), area("text", "Tekst")])],
      {
        eyebrow: "Zo werkt het",
        title: "Van intake tot rapportage.",
        items: [
          {
            title: "Intake en analyse",
            text: "We kijken naar je site, je concurrenten en je huidige linkprofiel. Daaruit volgt welke niches en welk type links het meest opleveren.",
          },
          {
            title: "Linkplan op maat",
            text: "Je krijgt een concreet voorstel: welke sites, welke ankerteksten, welk tempo en wat het kost. Pas na jouw akkoord gaan we plaatsen.",
          },
          {
            title: "Schrijven en plaatsen",
            text: "Onze redactie schrijft de artikelen, wij regelen de plaatsing en controleren elke link. Alles verschijnt in je dashboard.",
          },
          {
            title: "Rapportage en bijsturen",
            text: "Maandelijks een overzicht van geplaatste links en resultaat. Op basis daarvan sturen we het plan bij.",
          },
        ],
      }
    ),
    forWho: block(
      "Voor wie",
      [...heading, items("items", "Kaarten", "Kaart", [text("title", "Titel"), area("text", "Tekst")])],
      {
        eyebrow: "Voor wie",
        title: "Uitbesteden past bij…",
        items: [
          {
            title: "Ondernemers",
            text: "Je wilt groeien in Google en AI‑zoekmachines, maar hebt geen tijd om zelf links te kopen en teksten te laten schrijven.",
          },
          { title: "Marketingteams", text: "Linkbuilding is één van je kanalen, niet je dagtaak. Wij leveren de links, jij houdt het overzicht." },
          { title: "Bureaus", text: "Whitelabel uitvoering voor jouw klanten, op rekening, met één verzamelfactuur per maand." },
        ],
      }
    ),
    faq: faqBlock("FAQ", "Vragen over uitbesteden", [
      {
        q: "Wat kost linkbuilding uitbesteden?",
        a: "Je betaalt per geplaatste link, tegen dezelfde prijzen als in de marktplaats (bloglinks vanaf € {prijsBlog}). Het linkplan en het schrijven van de artikelen zijn inbegrepen. Geen abonnement.",
      },
      {
        q: "Zit ik ergens aan vast?",
        a: "Nee. Je geeft per plan akkoord en kunt op elk moment pauzeren of stoppen. Geplaatste bloglinks blijven gewoon staan.",
      },
      {
        q: "Mag ik meekijken en bijsturen?",
        a: "Ja. Je ziet elk voorstel vooraf en elke plaatsing in je dashboard. Wil je een site of ankertekst anders? Dan passen we dat aan.",
      },
      {
        q: "Werken jullie ook voor bureaus?",
        a: "Ja, veel bureaus laten de uitvoering aan ons over. We werken whitelabel en op rekening, met één factuur per maand.",
      },
    ]),
  },
});

// ---------------------------------------------------------------- over ons

export const aboutPage = definePage({
  slug: "over-ons",
  title: "Over ons",
  path: "/over-ons",
  canUnpublish: true,
  isPage: true,
  seo: {
    title: "Over Publito: linkbuilding zonder tussenlaag",
    description:
      "Publito is een linkbuilding marktplaats uit Nederland. Gecontroleerde sites, eerlijke prijzen en direct contact met de bron — zonder tussenlaag.",
    keyword: "linkbuilding marktplaats",
  },
  blocks: {
    intro: block("Introductie", [...heading, area("text", "Tekst", "Een lege regel begint een nieuwe alinea.")], {
      eyebrow: "Over Publito",
      title: "Linkbuilding zonder tussenlaag.",
      text: "Publito is ontstaan uit frustratie over de linkbuildingmarkt: onduidelijke prijzen, gekopieerde content en links op sites die niemand bezoekt. Wij wilden een plek waar je direct bij de publisher bestelt, vooraf ziet wat je krijgt en een artikel krijgt dat écht bij de site past.\n\nVandaag plaatsen we links op {sites} gecontroleerde sites in {landen}, voor ondernemers, marketingteams en bureaus. Zelf kiezen in de marktplaats of alles uitbesteden: de prijs per link is hetzelfde.",
    }),
    values: block(
      "Waar we voor staan",
      [...heading, items("items", "Afspraken", "Afspraak", [text("title", "Titel"), area("text", "Tekst")])],
      {
        eyebrow: "Waar we voor staan",
        title: "Vier afspraken die we niet loslaten.",
        items: [
          {
            title: "Direct bij de bron",
            text: "We zijn geen reseller. Elke site in de marktplaats is aangesloten door de publisher zelf, met een eigen prijs. Zo weet je precies waar je link komt te staan.",
          },
          {
            title: "Gecontroleerd aanbod",
            text: "Sites komen pas in de marktplaats na controle op echt verkeer, een eigen redactie en een natuurlijk linkprofiel. Wie niet (meer) voldoet, gaat eruit.",
          },
          {
            title: "Transparante cijfers",
            text: "DR, verkeer, niche en prijs staan vooraf bij elke site. Geen geschatte waarden achteraf, geen verrassingen op de factuur.",
          },
          {
            title: "Content die past",
            text: "Een link werkt alleen in een artikel dat bij de site past. Daarom schrijven we per plaatsing een uniek, redactioneel artikel. Of je levert zelf aan.",
          },
        ],
      }
    ),
    publishers: block("Voor publishers", [...heading, area("text", "Tekst")], {
      eyebrow: "Voor publishers",
      title: "Heb je zelf een site met bezoekers?",
      text: "Sluit je aan als publisher, bepaal zelf je prijs en ontvang bestellingen rechtstreeks in je eigen dashboard. Wij regelen de klant, de betaling en de content; jij plaatst het artikel. Interesse? Stuur een bericht via de contactpagina, dan nemen we de voorwaarden met je door.",
    }),
  },
});

// ---------------------------------------------------------------- contact

export const contactPage = definePage({
  slug: "contact",
  title: "Contact",
  path: "/contact",
  canUnpublish: true,
  isPage: true,
  seo: {
    title: "Contact en gratis linkbuilding-analyse · Publito",
    description:
      "Vraag een gratis linkbuilding‑analyse aan, overleg over uitbesteden of meld je site aan als publisher. We reageren binnen twee werkdagen.",
    keyword: "linkbuilding analyse",
  },
  blocks: {
    intro: block(
      "Contact",
      [
        ...heading,
        area("text", "Tekst"),
        items("details", "Gegevens naast het formulier", "Gegeven", [text("label", "Label"), text("value", "Waarde")]),
      ],
      {
        eyebrow: "Contact",
        title: "Laten we even sparren.",
        text: "Wil je weten welke links jouw site verder helpen? Vraag een gratis analyse aan, of stel je vraag over uitbesteden, samenwerken als bureau of je site aanmelden als publisher. We reageren binnen twee werkdagen.",
        details: [
          { label: "E-mail", value: "{email}" },
          { label: "Bereikbaar", value: "{uren}" },
          { label: "Werkgebied", value: "{landen}" },
        ],
      }
    ),
  },
});

// ---------------------------------------------------------------- blog

export const blogPage = definePage({
  slug: "blog",
  title: "Blog",
  path: "/blog",
  canUnpublish: true,
  isPage: true,
  seo: {
    title: "Blog over linkbuilding en zichtbaarheid in AI · Publito",
    description:
      "Praktische artikelen over backlinks, linkbuilding en hoe je merk genoemd wordt door Google én AI-assistenten. Van het team van Publito.",
    keyword: "linkbuilding blog",
  },
  blocks: {
    header: block("Kop van de pagina", [...heading, area("intro", "Introtekst")], {
      eyebrow: "Blog",
      title: "Kennis over linkbuilding en AI‑zoeken.",
      intro: "Praktische artikelen over backlinks, autoriteit en hoe je merk genoemd wordt door Google én AI‑assistenten.",
    }),
    list: block("Berichten", [text("empty", "Tekst als er nog geen berichten zijn")], {
      empty: "Binnenkort verschijnen hier onze eerste artikelen.",
    }),
  },
});

// ---------------------------------------------------------------- juridisch

const legal = (slug: string, title: string, pageTitle: string, notice: string, body: string) =>
  definePage({
    slug,
    title,
    path: `/${slug}`,
    canUnpublish: true,
    isPage: true,
    seo: { title: `${pageTitle} · Publito`, description: "", keyword: "" },
    blocks: {
      content: block(
        "Inhoud",
        [
          text("eyebrow", "Klein label boven de kop"),
          text("title", "Kop"),
          area("notice", "Gele melding bovenaan", "Leeg laten om de melding te verbergen."),
          area("text", "Tekst", "Een lege regel begint een nieuwe alinea."),
        ],
        { eyebrow: "Juridisch", title: pageTitle, notice, text: body }
      ),
    },
  });

export const privacyPage = legal(
  "privacy",
  "Privacybeleid",
  "Privacybeleid",
  "TODO: dit is een placeholder. De daadwerkelijke, juridisch correcte privacyverklaring moet nog door de platformeigenaar (eventueel met een jurist) worden opgesteld en hier worden geplaatst, vóórdat het platform live gaat met echte gebruikers.",
  "Hier komt te staan welke persoonsgegevens Publito verwerkt, met welk doel, op welke rechtsgrond, hoe lang ze worden bewaard, en welke rechten gebruikers hebben (inzage, correctie, verwijdering — zie ook de accountverwijdering onder Account-instellingen). Vragen over privacy: {email}."
);

export const termsPage = legal(
  "voorwaarden",
  "Algemene voorwaarden",
  "Algemene voorwaarden",
  "TODO: dit is een placeholder. De daadwerkelijke algemene voorwaarden (leveringsvoorwaarden, betaling, annulering/restitutie, aansprakelijkheid, toepasselijk recht) moeten nog door de platformeigenaar (eventueel met een jurist) worden opgesteld en hier worden geplaatst, vóórdat het platform live gaat met echte gebruikers.",
  "Hier komen de voorwaarden die gelden tussen Publito, klanten (die links inkopen) en publishers (die websites aanbieden)."
);

// ---------------------------------------------------------------- register

export const CMS_PAGES = {
  home: homePage,
  prijzen: pricesPage,
  uitbesteden: outsourcePage,
  "over-ons": aboutPage,
  contact: contactPage,
  blog: blogPage,
  privacy: privacyPage,
  voorwaarden: termsPage,
} as const;

export type CmsSlug = keyof typeof CMS_PAGES;
export const CMS_SLUGS = Object.keys(CMS_PAGES) as CmsSlug[];
export const isCmsSlug = (s: string): s is CmsSlug => s in CMS_PAGES;

/** Alle definities, inclusief de instellingen (voor de editor). */
export const ALL_DEFS: Record<string, PageDef> = { ...CMS_PAGES, _instellingen: settingsPage };
