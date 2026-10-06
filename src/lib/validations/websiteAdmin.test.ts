import { describe, expect, it } from "vitest";
import { normalizeDetails, normalizePrices } from "./websiteAdmin";

const details = {
  domain: "https://www.Voorbeeld.nl/blog",
  description: "",
  countryId: "nl",
  languageId: "nl",
  nicheIds: ["wonen", "bouw", "wonen"],
  maxLinks: "3",
  sponsored: false,
  exampleUrl: "voorbeeld.nl/artikel",
};

describe("normalizeDetails", () => {
  it("cleans up what was typed", () => {
    const r = normalizeDetails(details);
    expect(r.ok && r.data).toMatchObject({
      domain: "voorbeeld.nl",
      description: null,
      categoryId: "wonen",
      extraNicheIds: ["bouw"],
      maxLinks: 3,
      exampleUrl: "https://voorbeeld.nl/artikel",
    });
  });
  it("needs a niche and a sensible number of links", () => {
    expect(normalizeDetails({ ...details, nicheIds: [] }).ok).toBe(false);
    expect(normalizeDetails({ ...details, maxLinks: "0" }).ok).toBe(false);
    expect(normalizeDetails({ ...details, maxLinks: "" }).ok).toBe(true);
  });
});

describe("normalizePrices", () => {
  const topics = [{ id: "casino", name: "Casino" }];
  it("reads euro amounts, empty = not placed", () => {
    const r = normalizePrices(
      [{ type: "BLOG_POST", enabled: true, periodic: false, prices: { "": "129", casino: "" } }],
      topics
    );
    expect(r.ok && r.columns[0].general?.toNumber()).toBe(129);
    expect(r.ok && r.columns[0].topics[0].price).toBeNull();
    const comma = normalizePrices(
      [{ type: "BLOG_POST", enabled: true, periodic: false, prices: { "": "€ 99,50" } }],
      topics
    );
    expect(comma.ok && comma.columns[0].general?.toNumber()).toBe(99.5);
  });
  it("needs an Algemeen price for an offered product", () => {
    const r = normalizePrices(
      [{ type: "HOMEPAGE_LINK", enabled: true, periodic: true, prices: { casino: "200" } }],
      topics
    );
    expect(r).toEqual({ ok: false, error: "Vul de prijs voor Algemeen in bij Homepage-link." });
    expect(normalizePrices([{ type: "HOMEPAGE_LINK", enabled: false, periodic: true, prices: {} }], topics).ok).toBe(
      true
    );
  });
  it("refuses nonsense", () => {
    expect(
      normalizePrices([{ type: "BLOG_POST", enabled: true, periodic: false, prices: { "": "abc" } }], topics).ok
    ).toBe(false);
  });
});
