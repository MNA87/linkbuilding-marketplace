import { describe, expect, it } from "vitest";
import { invoicePeriod } from "./invoicePeriod";

describe("invoicePeriod", () => {
  it("covers one quarter", () => {
    const p = invoicePeriod("2026", "3");
    expect(p.from).toEqual(new Date(2026, 6, 1));
    expect(p.to).toEqual(new Date(2026, 9, 1));
    expect(p.label).toBe("Q3 2026");
  });

  it("covers a whole year without a quarter", () => {
    const p = invoicePeriod("2026", "");
    expect(p.from).toEqual(new Date(2026, 0, 1));
    expect(p.to).toEqual(new Date(2027, 0, 1));
  });

  it("falls back to the current year on nonsense", () => {
    expect(invoicePeriod("abc", "9", new Date(2026, 4, 1)).label).toBe("2026");
  });
});
