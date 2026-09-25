import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { briefLinksSchema, itemPrice, parseBriefLinks } from "./writingService";

describe("briefLinksSchema", () => {
  it("needs one or two complete links", () => {
    expect(briefLinksSchema.safeParse([{ anchor: "isolatie", url: "https://a.nl/x" }]).success).toBe(true);
    expect(briefLinksSchema.safeParse([]).success).toBe(false);
    expect(briefLinksSchema.safeParse([{ anchor: "", url: "https://a.nl" }]).success).toBe(false);
    expect(briefLinksSchema.safeParse([{ anchor: "x", url: "a.nl" }]).success).toBe(false);
    expect(
      briefLinksSchema.safeParse([
        { anchor: "a", url: "https://a.nl" },
        { anchor: "b", url: "https://b.nl" },
        { anchor: "c", url: "https://c.nl" },
      ]).success
    ).toBe(false);
  });
  it("only accepts web links", () => {
    expect(briefLinksSchema.safeParse([{ anchor: "x", url: "javascript:alert(1)" }]).success).toBe(false);
    expect(briefLinksSchema.safeParse([{ anchor: "x", url: "mailto:a@b.nl" }]).success).toBe(false);
    expect(briefLinksSchema.safeParse([{ anchor: "x", url: "http://a.nl" }]).success).toBe(true);
  });
  it("parses stored links, empty for junk", () => {
    expect(parseBriefLinks(null)).toEqual([]);
    expect(parseBriefLinks([{ anchor: " a ", url: "https://a.nl" }])).toEqual([{ anchor: "a", url: "https://a.nl" }]);
  });
});

describe("itemPrice", () => {
  it("adds the writing fee", () => {
    expect(itemPrice({ customerPriceSnap: new Prisma.Decimal("149"), writingFeeSnap: new Prisma.Decimal("25") }).toFixed(2)).toBe("174.00");
  });
});
