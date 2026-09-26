import { describe, expect, it } from "vitest";
import { headerSort, isNew, parseSort, popularIds, sortRows } from "./marketplace";

const row = (id: string, o: Partial<{ orders: number; days: number; price: number; dr: number | null; tf: number | null; traffic: number | null }>) => ({
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
    expect(parseSort("zomaar")).toBe("populair");
    expect(parseSort(undefined)).toBe("populair");
  });
  it("sorts by price, DR (missing last) and popularity", () => {
    const rows = [row("a", { price: 200, dr: null, orders: 1 }), row("b", { price: 50, dr: 40, orders: 5 }), row("c", { price: 120, dr: 20, orders: 5, days: 1 })];
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
    const rows = [row("a", { orders: 2 }), row("b", { orders: 3 }), row("c", { orders: 9 }), row("d", { orders: 4 }), row("e", { orders: 5 })];
    expect(Array.from(popularIds(rows)).sort()).toEqual(["c", "d", "e"]);
    expect(popularIds([row("a", { orders: 2 })]).size).toBe(0);
  });
  it("marks sites from the last month as new", () => {
    expect(isNew(new Date(Date.now() - 5 * 86400000))).toBe(true);
    expect(isNew(new Date(Date.now() - 40 * 86400000))).toBe(false);
  });
});
