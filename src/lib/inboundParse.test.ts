import { describe, expect, it } from "vitest";
import {
  findDomain,
  findForwarded,
  linksFromText,
  mailSnippet,
  parseEuro,
  parseRequests,
  placementLine,
  readArticle,
  splitSenderName,
} from "./inboundParse";
import { googleDocId } from "./googleDoc";

const OWN = ["digikeur.nl", "a2f.nl", "nugevonden.nl"];

describe("findDomain", () => {
  it("finds the site named in the subject before the body", () => {
    expect(findDomain(["Artikel voor nugevonden.nl", "ook digikeur.nl"], OWN)).toBe("nugevonden.nl");
  });
  it("takes the first one named in a text", () => {
    expect(findDomain(["graag op digikeur.nl of anders a2f.nl"], OWN)).toBe("digikeur.nl");
  });
  it("doesn't match a longer domain", () => {
    expect(findDomain(["staat op xa2f.nl en a2f.nl.evil.com"], OWN)).toBeNull();
  });
  it("ignores a site's domain in a mail address", () => {
    expect(findDomain(["To: <info@nugevonden.nl>\n\nGraag op digikeur.nl"], OWN)).toBe("digikeur.nl");
  });
  it("matches at the end of a sentence", () => {
    expect(findDomain(["Graag op a2f.nl."], OWN)).toBe("a2f.nl");
  });
  it("matches with www and in a URL", () => {
    expect(findDomain(["https://www.A2F.nl/blog"], OWN)).toBe("a2f.nl");
  });
});

describe("readArticle", () => {
  it("uses the first heading as title and keeps links", () => {
    const html =
      '<h1>10 tips voor een duurzame tuin</h1><p>Vang regen op met een <a href="https://tuinwinkel.nl/regentonnen">regenton kopen</a>.</p>';
    const a = readArticle(html, OWN);
    expect(a.title).toBe("10 tips voor een duurzame tuin");
    expect(a.body).not.toContain("<h1>");
    expect(a.links).toEqual([{ anchor: "regenton kopen", url: "https://tuinwinkel.nl/regentonnen" }]);
  });
  it("uses a short first line as title when there is no heading", () => {
    const a = readArticle("<p>Duurzaam tuinieren</p><p>Lange tekst hier.</p>");
    expect(a.title).toBe("Duurzaam tuinieren");
    expect(a.body).toBe("<p>Lange tekst hier.</p>");
  });
  it("leaves a first sentence in the text", () => {
    expect(readArticle("<p>Dit is gewoon een zin.</p>").title).toBeNull();
  });
  it("drops links to our own sites and strips scripts", () => {
    const a = readArticle('<p><a href="https://digikeur.nl/x">eigen</a><script>alert(1)</script></p>', OWN);
    expect(a.links).toEqual([]);
    expect(a.body).not.toContain("script");
  });
});

describe("linksFromText", () => {
  it("reads anchor - url on one line", () => {
    expect(linksFromText("regenton kopen - https://tuinwinkel.nl/regentonnen")).toEqual([
      { anchor: "regenton kopen", url: "https://tuinwinkel.nl/regentonnen" },
    ]);
  });
  it("prefers a quoted anchor", () => {
    expect(linksFromText('Anker: "regenton kopen" → https://tuinwinkel.nl/a.')).toEqual([
      { anchor: "regenton kopen", url: "https://tuinwinkel.nl/a" },
    ]);
  });
  it("pairs an anchor line with the URL line below", () => {
    expect(linksFromText("Ankertekst: regenton kopen\nURL: https://tuinwinkel.nl/a")).toEqual([
      { anchor: "regenton kopen", url: "https://tuinwinkel.nl/a" },
    ]);
  });
  it("skips our own sites and quoted mail", () => {
    expect(linksFromText("graag op https://digikeur.nl\n> oud: https://x.nl", OWN)).toEqual([]);
  });
});

describe("findForwarded", () => {
  it("reads a Gmail forward", () => {
    const text = `Kun je deze oppakken?

---------- Forwarded message ---------
From: Sanne de Vries <sanne@seobureau.nl>
Date: Thu, 2 Oct 2026 at 10:14
Subject: Artikel digikeur.nl
To: <info@nugevonden.nl>

Hoi, hierbij het artikel.`;
    expect(findForwarded(text)).toEqual({
      fromEmail: "sanne@seobureau.nl",
      fromName: "Sanne de Vries",
      subject: "Artikel digikeur.nl",
    });
  });
  it("reads a Dutch Outlook forward", () => {
    const text = `________________________________
Van: Lisa Jansen <Lisa@MarketingPro.nl>
Verzonden: donderdag 2 oktober 2026 10:14
Aan: info@nugevonden.nl
Onderwerp: Link op nugevonden

Hallo`;
    expect(findForwarded(text)).toEqual({
      fromEmail: "lisa@marketingpro.nl",
      fromName: "Lisa Jansen",
      subject: "Link op nugevonden",
    });
  });
  it("reads an Apple Mail forward in Dutch", () => {
    const text = `Begin doorgestuurd bericht:

Van: jan@example.nl
Onderwerp: Graag een artikel
Datum: 2 oktober 2026 om 10:14:00 CEST`;
    expect(findForwarded(text)).toEqual({ fromEmail: "jan@example.nl", fromName: null, subject: "Graag een artikel" });
  });
  it("reads Outlook's mailto style", () => {
    const text = `-----Original Message-----
From: Piet Bakker [mailto:piet@bakker.nl]
Sent: Thursday, October 2, 2026 10:14 AM
Subject: Blog`;
    expect(findForwarded(text)?.fromEmail).toBe("piet@bakker.nl");
    expect(findForwarded(text)?.fromName).toBe("Piet Bakker");
  });
  it("skips your own address and takes the customer below it", () => {
    const text = `---------- Forwarded message ---------
From: Nugevonden <info@nugevonden.nl>
Subject: Re: Artikel

> ---------- Forwarded message ---------
From: Sanne <sanne@seobureau.nl>
Subject: Artikel`;
    expect(findForwarded(text, ["info@nugevonden.nl"])?.fromEmail).toBe("sanne@seobureau.nl");
  });
  it("is null for a normal mail", () => {
    expect(findForwarded("Hoi, hierbij het artikel voor digikeur.nl.\n\nGroet, Sanne")).toBeNull();
  });
});

describe("lists of links and anchors (All the way up)", () => {
  const mail = `Hoi,

Links: https://www.studiekeuzelab.nl/;
https://www.studiekeuzelab.nl/kies/studiefinanciering-ins-outs
Linkteksten: 1: studiekeuze 2: studiefinanciering

Website plaatsing: digikeur.nl

Groet`;
  it("pairs the first anchor with the first link", () => {
    expect(linksFromText(mail, OWN)).toEqual([
      { anchor: "studiekeuze", url: "https://www.studiekeuzelab.nl/" },
      { anchor: "studiefinanciering", url: "https://www.studiekeuzelab.nl/kies/studiefinanciering-ins-outs" },
    ]);
  });
  it("reads the placement line", () => {
    expect(placementLine(mail)).toContain("digikeur.nl");
    expect(findDomain([placementLine(mail) ?? ""], OWN)).toBe("digikeur.nl");
  });
  it("takes the site from the line below the label", () => {
    expect(findDomain([placementLine("Website plaatsing:\nnugevonden.nl\n") ?? ""], OWN)).toBe("nugevonden.nl");
  });
  it("handles anchors as a plain list", () => {
    expect(linksFromText("Links: https://a.nl/x https://a.nl/y\nAnkerteksten: eerste, tweede", OWN)).toEqual([
      { anchor: "eerste", url: "https://a.nl/x" },
      { anchor: "tweede", url: "https://a.nl/y" },
    ]);
  });
});

describe("splitSenderName and mailSnippet", () => {
  it("splits 'naam van bedrijf'", () => {
    expect(splitSenderName("Tim van All the way up")).toEqual({ name: "Tim", company: "All the way up" });
    expect(splitSenderName("Sanne de Vries")).toEqual({ name: "Sanne de Vries", company: "" });
  });
  it("keeps only the customer's own words", () => {
    const fwd =
      "---------- Forwarded message ---------\nVan: Tim <tim@x.nl>\nSubject: Opdracht\n\nHoi,\n\nLinks: https://a.nl";
    expect(mailSnippet(fwd)).toBe("Hoi,\n\nLinks: https://a.nl");
    const reply = "Akkoord!\n\nGroet, Tim\n\nOp 3 okt 2026 om 10:00 schreef Nugevonden <seo@x.nl>:\n> Hoi Tim";
    expect(mailSnippet(reply)).toBe("Akkoord!\n\nGroet, Tim");
  });
});

describe("parseRequests (Traffic Today)", () => {
  const mail = `Hoi,

Ik heb 2 aanvragen binnengekregen. Zou je deze willen oppakken? Zou je de opleveringen in kolom C van de spreadsheet willen plaatsen?

https://docs.google.com/spreadsheets/d/1hrwELXunmIFYyzcXoYXhoIZ3Qz7P5UTT0NvXo-rzMnI

Aanvraag 1/2:
- Klant: vandalencontainers.nl
- Docs URL: https://docs.google.com/document/d/1ALNmE3KBujw9np8uObxl2PYVNQJw22UTyy7ADvnjqoU/edit
- Opmerkingen: -
- Partner URL: kvinl.nl
- Tarief: €250,00
- Order ID: SEP26-1786625487-RCHNS2



Aanvraag 2/2:
- Klant: kinglaminaat.nl
- Docs URL: https://docs.google.com/document/d/1nyfUdYeoXf6jonN_1HBu4H_P65Bf3mQRYIEFcJ3Vug4/edit
- Opmerkingen: -
- Partner URL: oato.nl
- Tarief: €150,00
- Order ID: SEP26-1788330561-B588BU
`;
  it("reads each request on its own and skips the spreadsheet", () => {
    expect(parseRequests(mail)).toEqual([
      {
        label: "1/2",
        docUrl: "https://docs.google.com/document/d/1ALNmE3KBujw9np8uObxl2PYVNQJw22UTyy7ADvnjqoU/edit",
        client: "vandalencontainers.nl",
        partner: "kvinl.nl",
        price: 250,
        ref: "SEP26-1786625487-RCHNS2",
        notes: null,
      },
      {
        label: "2/2",
        docUrl: "https://docs.google.com/document/d/1nyfUdYeoXf6jonN_1HBu4H_P65Bf3mQRYIEFcJ3Vug4/edit",
        client: "kinglaminaat.nl",
        partner: "oato.nl",
        price: 150,
        ref: "SEP26-1788330561-B588BU",
        notes: null,
      },
    ]);
  });
  it("takes a single request without the heading when it has a Docs URL", () => {
    expect(parseRequests("Docs URL: https://docs.google.com/document/d/abc/edit\nPartner URL: oato.nl")).toHaveLength(
      1
    );
    expect(parseRequests("Hoi, hier een gewone mail.")).toEqual([]);
  });
  it("reads euro amounts", () => {
    expect(parseEuro("€250,00")).toBe(250);
    expect(parseEuro("€ 1.250,50")).toBe(1250.5);
    expect(parseEuro("99")).toBe(99);
  });
  it("finds the Google Doc id", () => {
    expect(
      googleDocId("https://docs.google.com/document/d/1XB8HGa5wMoi8xwj_sNreBkdzmDkUiIau1nIAUz1HaIA/edit?usp=drivesdk")
    ).toBe("1XB8HGa5wMoi8xwj_sNreBkdzmDkUiIau1nIAUz1HaIA");
    expect(
      googleDocId("https://docs.google.com/spreadsheets/d/1hrwELXunmIFYyzcXoYXhoIZ3Qz7P5UTT0NvXo-rzMnI")
    ).toBeNull();
  });
});
