import { describe, expect, it } from "vitest";
import {
  DEFAULT_COLUMNS,
  filterOptions,
  filterRows,
  moveColumn,
  parseColumns,
  serializeColumns,
  headerSort,
  isNew,
  pageNumbers,
  parseFilters,
  parseSort,
  popularIds,
  sortRows,
} from "./marketplace";

const row = (
  id: string,
  o: Partial<{
    orders: number;
    days: number;
    price: number;
    dr: number | null;
    tf: number | null;
    traffic: number | null;
  }>
) => ({
  id,
  domain: `${id}.nl`,
  orders: o.orders ?? 0,
  createdAt: new Date(Date.now() - (o.days ?? 100) * 86400000),
  price: o.price ?? 100,
  domainRating: o.dr === undefined ? 30 : o.dr,
  domainAuthority: 20,
  trustFlow: o.tf === undefined ? 10 : o.tf,
  citationFlow: 15,
  traffic: o.traffic === undefined ? 1000 : o.traffic,
});

describe("marketplace sorting", () => {
  it("falls back to the default sort", () => {
    expect(parseSort("prijs-laag")).toBe("prijs-laag");
    expect(parseSort("zomaar")).toBe("dr");
    expect(parseSort(undefined)).toBe("dr");
  });
  it("sorts by price, DR (missing last) and popularity", () => {
    const rows = [
      row("a", { price: 200, dr: null, orders: 1 }),
      row("b", { price: 50, dr: 40, orders: 5 }),
      row("c", { price: 120, dr: 20, orders: 5, days: 1 }),
    ];
    expect(sortRows(rows, "prijs-laag").map((r) => r.id)).toEqual(["b", "c", "a"]);
    expect(sortRows(rows, "dr").map((r) => r.id)).toEqual(["b", "c", "a"]);
    expect(sortRows(rows, "populair").map((r) => r.id)).toEqual(["c", "b", "a"]);
  });
  it("sorts a figure low–high too, missing ones still last", () => {
    const rows = [row("a", { tf: null }), row("b", { tf: 40 }), row("c", { tf: 5 })];
    expect(sortRows(rows, "tf").map((r) => r.id)).toEqual(["b", "c", "a"]);
    expect(sortRows(rows, "tf-laag").map((r) => r.id)).toEqual(["c", "b", "a"]);
  });
  it("flips a column header between high–low and low–high", () => {
    expect(headerSort("dr", "populair")).toBe("dr");
    expect(headerSort("dr", "dr")).toBe("dr-laag");
    expect(headerSort("dr", "dr-laag")).toBe("dr");
  });
  it("only labels sites as popular after a few orders, at most three", () => {
    const rows = [
      row("a", { orders: 2 }),
      row("b", { orders: 3 }),
      row("c", { orders: 9 }),
      row("d", { orders: 4 }),
      row("e", { orders: 5 }),
    ];
    expect(Array.from(popularIds(rows)).sort()).toEqual(["c", "d", "e"]);
    expect(popularIds([row("a", { orders: 2 })]).size).toBe(0);
  });
  it("marks sites from the last month as new", () => {
    expect(isNew(new Date(Date.now() - 5 * 86400000))).toBe(true);
    expect(isNew(new Date(Date.now() - 40 * 86400000))).toBe(false);
  });
});

describe("table filters", () => {
  const site = (domain: string, extra: Partial<Parameters<typeof filterRows>[0][number]> = {}) => ({
    domain,
    niches: [{ id: "tech", name: "Tech" }],
    countryId: "nl",
    languageId: "nl",
    domainRating: 40,
    domainAuthority: 30,
    traffic: 1000,
    maxLinks: 2,
    sponsored: false,
    periodic: false,
    price: 129,
    ...extra,
  });
  const rows = [
    site("digikeur.nl", { domainRating: 72 }),
    site("woonidee.nl", { niches: [{ id: "wonen", name: "Wonen" }], periodic: true, price: 300 }),
    site("tuinpraat.be", { countryId: "be", sponsored: true, domainRating: null }),
  ];
  const domains = (q: Record<string, string>) => filterRows(rows, parseFilters(q)).map((r) => r.domain);

  it("searches domain and niche", () => {
    expect(domains({ q: "wonen" })).toEqual(["woonidee.nl"]);
    expect(domains({ domain: ".nl" })).toEqual(["digikeur.nl", "woonidee.nl"]);
  });
  it("filters on figures, leaving out sites without them", () => {
    expect(domains({ minDr: "50" })).toEqual(["digikeur.nl"]);
    expect(domains({ minDr: "0" })).toEqual(["digikeur.nl", "woonidee.nl"]);
  });
  it("filters on niche, country, sponsored, duration and price", () => {
    expect(domains({ niche: "wonen" })).toEqual(["woonidee.nl"]);
    expect(domains({ country: "be" })).toEqual(["tuinpraat.be"]);
    expect(domains({ sponsored: "ja" })).toEqual(["tuinpraat.be"]);
    expect(domains({ duur: "jaar" })).toEqual(["woonidee.nl"]);
    expect(domains({ maxPrice: "200" })).toEqual(["digikeur.nl", "tuinpraat.be"]);
  });
  it("ignores nonsense in the URL", () => {
    expect(domains({ minDr: "abc", sponsored: "misschien" })).toHaveLength(3);
  });
  it("numbers the pages", () => {
    expect(pageNumbers(1, 3)).toEqual([1, 2, 3]);
    expect(pageNumbers(5, 12)).toEqual([1, 0, 4, 5, 6, 0, 12]);
    expect(pageNumbers(1, 12)).toEqual([1, 2, 0, 12]);
  });
});

describe("columns", () => {
  it("starts with the calm default", () => {
    expect(parseColumns(undefined)).toEqual(DEFAULT_COLUMNS);
    expect(parseColumns("onzin")).toEqual(DEFAULT_COLUMNS);
  });
  it("keeps the order and what's on, dropping unknown columns", () => {
    const prefs = parseColumns("verkeer.-niche.land.onzin");
    expect(prefs.order.slice(0, 3)).toEqual(["verkeer", "niche", "land"]);
    expect(prefs.shown).toEqual(["verkeer", "land"]);
    expect(prefs.order).toHaveLength(12);
  });
  it("survives a round trip, also with everything off", () => {
    const prefs = { order: moveColumn(DEFAULT_COLUMNS.order, "duur", "niche"), shown: [] };
    expect(parseColumns(serializeColumns(prefs))).toEqual(prefs);
  });
  it("moves a column to where it's dropped", () => {
    expect(moveColumn(["niche", "land", "taal", "dr"] as never, "taal", "niche")).toEqual([
      "taal",
      "niche",
      "land",
      "dr",
    ]);
    expect(moveColumn(["niche", "land", "taal", "dr"] as never, "niche", "taal")).toEqual([
      "land",
      "taal",
      "niche",
      "dr",
    ]);
  });
});

describe("filterOptions", () => {
  const all = [
    { id: "a", name: "Auto" },
    { id: "g", name: "Gaming" },
    { id: "w", name: "Wonen" },
  ];
  it("offers only what the sites have, with how many", () => {
    expect(filterOptions(all, [["a", "w"], ["w"], ["w", "w"]], "")).toEqual([
      { id: "a", name: "Auto", count: 1 },
      { id: "w", name: "Wonen", count: 3 },
    ]);
  });
  it("keeps the one picked, even without sites", () => {
    expect(filterOptions(all, [["a"]], "g").map((o) => [o.name, o.count])).toEqual([
      ["Auto", 1],
      ["Gaming", 0],
    ]);
  });
});
