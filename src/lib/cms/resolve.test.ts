import { describe, expect, it } from "vitest";
import { homePage, settingsPage } from "./pages";
import { diffPage, fillTokens, resolvePage, safeHref, seoScore } from "./resolve";
import type { PageDef } from "./types";

const home = homePage as unknown as PageDef;

describe("resolvePage", () => {
  it("geeft zonder doc precies de standaard terug", () => {
    const r = resolvePage(home, null);
    expect(r.order).toEqual(Object.keys(home.blocks));
    expect(r.hidden).toEqual([]);
    expect(r.blocks.hero.title1).toBe("Google vindt je.");
    expect(r.seo.title).toBe(home.seo.title);
  });

  it("past alleen de opgeslagen afwijkingen toe", () => {
    const r = resolvePage(home, { blocks: { hero: { title2: "Nieuwe regel." } }, hidden: ["compare"] });
    expect(r.blocks.hero.title2).toBe("Nieuwe regel.");
    expect(r.blocks.hero.title1).toBe("Google vindt je.");
    expect(r.hidden).toEqual(["compare"]);
  });

  it("negeert onbekende blokken, velden en verkeerde types", () => {
    const r = resolvePage(home, {
      order: ["faq", "weg", "hero"],
      hidden: ["bestaatniet"],
      blocks: { hero: { title1: 42, onbekend: "x" }, nope: { a: 1 } },
    } as never);
    expect(r.order[0]).toBe("faq");
    expect(r.order[1]).toBe("hero");
    expect(r.order).toHaveLength(Object.keys(home.blocks).length);
    expect(r.hidden).toEqual([]);
    expect(r.blocks.hero.title1).toBe("Google vindt je.");
  });

  it("vult items aan met de velden van het blok", () => {
    const r = resolvePage(home, { blocks: { faq: { items: [{ q: "Alleen een vraag" }, "rommel"] } } } as never);
    expect(r.blocks.faq.items).toEqual([{ q: "Alleen een vraag", a: expect.any(String) }]);
  });
});

describe("diffPage", () => {
  it("is leeg als niets afwijkt", () => {
    expect(diffPage(home, resolvePage(home, null))).toEqual({});
  });

  it("bewaart alleen wat veranderd is en is omkeerbaar", () => {
    const full = resolvePage(home, null);
    full.blocks.hero.title2 = "Anders.";
    full.hidden = ["prices"];
    full.seo.description = "Nieuwe omschrijving";
    const doc = diffPage(home, full);
    expect(doc).toEqual({
      hidden: ["prices"],
      blocks: { hero: { title2: "Anders." } },
      seo: { description: "Nieuwe omschrijving" },
    });
    expect(resolvePage(home, doc)).toEqual(full);
  });

  it("werkt ook voor de instellingen met items", () => {
    const s = settingsPage as unknown as PageDef;
    const full = resolvePage(s, null);
    const cards = full.blocks.prijskaarten.cards as Record<string, unknown>[];
    cards[0] = { ...cards[0], price: "39" };
    const doc = diffPage(s, full);
    expect(Object.keys(doc.blocks ?? {})).toEqual(["prijskaarten"]);
    expect(resolvePage(s, doc).blocks.prijskaarten.cards).toEqual(cards);
  });
});

describe("fillTokens", () => {
  it("vervangt tokens in strings, arrays en objecten en laat onbekende staan", () => {
    const out = fillTokens({ a: "{sites} sites", b: ["€ {prijsBlog}", "{x}"], c: { d: "{email}" } }, { sites: "500+", prijsBlog: "35", email: "a@b.nl" });
    expect(out).toEqual({ a: "500+ sites", b: ["€ 35", "{x}"], c: { d: "a@b.nl" } });
  });
});

describe("safeHref en seoScore", () => {
  it("laat alleen veilige links door", () => {
    expect(safeHref("/prijzen")).toBe("/prijzen");
    expect(safeHref("https://publito.nl")).toBe("https://publito.nl");
    expect(safeHref("javascript:alert(1)")).toBe("/");
    expect(safeHref("//evil.nl")).toBe("/");
  });

  it("beoordeelt de SEO-lengtes", () => {
    expect(seoScore({ title: "x".repeat(45), description: "y".repeat(130), keyword: "" })).toBe("good");
    expect(seoScore({ title: "kort", description: "kort", keyword: "" })).toBe("ok");
    expect(seoScore({ title: "", description: "", keyword: "" })).toBe("bad");
  });
});
