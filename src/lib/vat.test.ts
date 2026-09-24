import { describe, expect, it } from "vitest";
import { euro, vatTotals } from "./vat";

describe("vatTotals", () => {
  it("adds 21% VAT on top, in cents", () => {
    expect(vatTotals([129], 21)).toEqual({ subtotal: 129, vat: 27.09, total: 156.09 });
    expect(vatTotals([99.99, 0.01], 21)).toEqual({ subtotal: 100, vat: 21, total: 121 });
  });

  it("rounds the VAT to the nearest cent", () => {
    expect(vatTotals([10.05], 21)).toEqual({ subtotal: 10.05, vat: 2.11, total: 12.16 });
  });

  it("leaves old orders without VAT untouched", () => {
    expect(vatTotals([129, 50], 0)).toEqual({ subtotal: 179, vat: 0, total: 179 });
  });

  it("accepts Prisma Decimals", () => {
    const dec = (n: number) => ({ toNumber: () => n });
    expect(vatTotals([dec(129)], dec(21)).total).toBe(156.09);
  });
});

describe("euro", () => {
  it("formats in Dutch style", () => {
    expect(euro(1234.5).replace(/\s/g, " ")).toBe("€ 1.234,50");
  });
});
