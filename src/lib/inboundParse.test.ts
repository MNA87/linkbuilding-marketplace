import { describe, expect, it } from "vitest";
import { findDomain, linksFromText, readArticle } from "./inboundParse";

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
