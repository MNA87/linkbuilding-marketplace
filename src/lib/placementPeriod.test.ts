import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import {
  addYears,
  amsterdamDay,
  durationYearsSchema,
  priceForYears,
  publishAtFromDay,
  publishOnSchema,
  scheduleBounds,
  yearlyPrice,
} from "./placementPeriod";

describe("price per period", () => {
  it("is the yearly price times the years, and back", () => {
    const period = priceForYears(new Prisma.Decimal("129.00"), 3);
    expect(period.toFixed(2)).toBe("387.00");
    expect(yearlyPrice(period, 3).toFixed(2)).toBe("129.00");
  });
});

describe("addYears", () => {
  it("adds whole years", () => {
    expect(addYears(new Date("2026-09-24T10:00:00Z"), 2).toISOString()).toBe("2028-09-24T10:00:00.000Z");
  });
});

describe("scheduling", () => {
  const now = new Date("2026-09-24T22:30:00Z"); // already 25 Sept in NL

  it("uses the Dutch calendar day", () => {
    expect(amsterdamDay(now)).toBe("2026-09-25");
    expect(scheduleBounds(now)).toEqual({ min: "2026-09-26", max: "2027-09-25" });
  });

  it("accepts direct or a day within the next year", () => {
    const schema = publishOnSchema(now);
    expect(schema.safeParse("").success).toBe(true);
    expect(schema.safeParse("2026-09-26").success).toBe(true);
    expect(schema.safeParse("2027-09-25").success).toBe(true);
  });

  it("rejects today, the past, more than a year ahead and junk", () => {
    const schema = publishOnSchema(now);
    for (const v of ["2026-09-25", "2026-01-01", "2027-09-26", "morgen"]) {
      expect(schema.safeParse(v).success).toBe(false);
    }
  });

  it("publishes a planned day in the morning", () => {
    expect(publishAtFromDay("2026-10-01").toISOString()).toBe("2026-10-01T06:00:00.000Z");
  });
});

describe("durationYearsSchema", () => {
  it("allows 1 to 3 years", () => {
    expect(durationYearsSchema.parse("3")).toBe(3);
    expect(durationYearsSchema.safeParse(0).success).toBe(false);
    expect(durationYearsSchema.safeParse(4).success).toBe(false);
  });
});
