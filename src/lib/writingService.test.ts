import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { briefLinksSchema, itemNeedsContent, itemPrice, parseBriefLinks } from "./writingService";

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

describe("itemNeedsContent", () => {
  const empty = { renewsOrderItemId: null, targetUrl: null, articleTitle: null, writeForMe: false, briefLinks: null };
  it("knows what each kind of item needs", () => {
    expect(itemNeedsContent(empty, "BLOG_POST")).toBe(true);
    expect(itemNeedsContent({ ...empty, articleTitle: "Titel" }, "BLOG_POST")).toBe(false);
    expect(itemNeedsContent({ ...empty, writeForMe: true }, "BLOG_POST")).toBe(true);
    expect(
      itemNeedsContent({ ...empty, writeForMe: true, briefLinks: [{ anchor: "a", url: "https://a.nl" }] }, "BLOG_POST")
    ).toBe(false);
    expect(itemNeedsContent({ ...empty, targetUrl: "https://a.nl" }, "HOMEPAGE_LINK")).toBe(false);
    expect(itemNeedsContent({ ...empty, renewsOrderItemId: "x" }, "BLOG_POST")).toBe(false);
  });
});
