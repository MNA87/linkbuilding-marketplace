import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import {
  STANDARD_TERMS,
  priceForCustomer,
  priceSourceLabel,
  topicStandardPrice,
  type CustomerTerms,
} from "./customerPricing";

const D = (n: number) => new Prisma.Decimal(n);
const terms = (discount: number | null, fixed: [string, number][] = []): CustomerTerms => ({
  discountPercent: discount === null ? null : D(discount),
  writingIncluded: false,
  fixed: new Map(fixed.map(([id, p]) => [id, D(p)])),
});

describe("priceForCustomer", () => {
  it("is the standard price without agreements", () => {
    const r = priceForCustomer(D(129), "wp1", STANDARD_TERMS);
    expect(r.price.toNumber()).toBe(129);
    expect(r.source).toBe("standard");
  });
  it("takes the discount off", () => {
    const r = priceForCustomer(D(199), "wp1", terms(20));
    expect(r.price.toFixed(2)).toBe("159.20");
    expect(r.source).toBe("discount");
  });
  it("rounds to cents", () => {
    expect(priceForCustomer(D(99.99), "wp1", terms(12.5)).price.toFixed(2)).toBe("87.49");
  });
  it("puts a fixed price before the discount", () => {
    const r = priceForCustomer(D(129), "wp1", terms(20, [["wp1", 90]]));
    expect(r.price.toNumber()).toBe(90);
    expect(r.source).toBe("fixed");
  });
  it("only fixes the price of that product", () => {
    expect(priceForCustomer(D(120), "wp2", terms(20, [["wp1", 90]])).price.toNumber()).toBe(96);
  });
  it("ignores a 0% discount", () => {
    expect(priceForCustomer(D(120), "wp1", terms(0)).source).toBe("standard");
  });
  it("labels the source", () => {
    expect(priceSourceLabel("discount", terms(20))).toBe("20% korting");
    expect(priceSourceLabel("fixed", terms(null))).toBe("vaste prijs");
  });
});

describe("topics", () => {
  const product = { supplierPrice: D(129), topicPrices: [{ topicId: "casino", price: D(249) }] };
  it("uses the product's price for Algemeen and the topic's own price otherwise", () => {
    expect(topicStandardPrice(product, null)?.toNumber()).toBe(129);
    expect(topicStandardPrice(product, "casino")?.toNumber()).toBe(249);
  });
  it("has no price for a topic the site doesn't place", () => {
    expect(topicStandardPrice(product, "crypto")).toBeNull();
  });
  it("applies a fixed customer price to Algemeen only, the discount to every topic", () => {
    expect(priceForCustomer(D(249), "wp1", terms(null, [["wp1", 90]]), "casino").price.toNumber()).toBe(249);
    expect(priceForCustomer(D(249), "wp1", terms(20, [["wp1", 90]]), "casino").price.toFixed(2)).toBe("199.20");
    expect(priceForCustomer(D(129), "wp1", terms(20, [["wp1", 90]]), null).price.toNumber()).toBe(90);
  });
});
