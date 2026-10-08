import { describe, expect, it } from "vitest";
import { dueDate, groupKey, parseGroupKey, periodLabel, periodOf, periodOver } from "./collectiveInvoices";

describe("collectiveInvoices", () => {
  it("puts an order in its Dutch month", () => {
    expect(periodOf(new Date("2026-10-31T23:30:00Z"))).toBe("2026-11"); // 00:30 on 1 Nov in Amsterdam
    expect(periodOf(new Date("2026-10-31T21:30:00Z"))).toBe("2026-10");
    expect(periodLabel("2026-10")).toBe("oktober 2026");
  });
  it("knows when a month is over", () => {
    expect(periodOver("2026-10", new Date("2026-10-31T12:00:00Z"))).toBe(false);
    expect(periodOver("2026-10", new Date("2026-11-01T12:00:00Z"))).toBe(true);
  });
  it("is due in 30 days", () => {
    expect(dueDate(new Date("2026-11-01T10:00:00Z")).toISOString()).toBe("2026-12-01T10:00:00.000Z");
  });
  it("reads back a group key", () => {
    expect(parseGroupKey(groupKey("c1", "2026-10", 21))).toEqual({ companyId: "c1", period: "2026-10", vatRate: 21 });
    expect(parseGroupKey("rommel")).toBeNull();
  });
});
