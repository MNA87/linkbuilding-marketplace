import { describe, it, expect } from "vitest";
import { createOrderSchema } from "./order";

const base = {
  websiteProductId: "clxxxxxxxxxxxxxxxxxxxxxxx",
  articleTitle: "Titel",
  articleBody: "<p>Een <strong>mooi</strong> artikel met een <a href=\"https://klant.nl/pagina\">link</a>.</p>",
};

describe("createOrderSchema", () => {
  it("accepts a valid order", () => {
    const result = createOrderSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it("rejects a missing title", () => {
    const result = createOrderSchema.safeParse({ ...base, articleTitle: "" });
    expect(result.success).toBe(false);
  });

  it("accepts a title of exactly 70 characters and rejects 71", () => {
    expect(createOrderSchema.safeParse({ ...base, articleTitle: "a".repeat(70) }).success).toBe(true);
    expect(createOrderSchema.safeParse({ ...base, articleTitle: "a".repeat(71) }).success).toBe(false);
  });

  it("rejects an empty rich text editor body (just an empty paragraph tag)", () => {
    const result = createOrderSchema.safeParse({ ...base, articleBody: "<p></p>" });
    expect(result.success).toBe(false);
  });

  it("accepts rich text editor HTML with real text content", () => {
    const result = createOrderSchema.safeParse(base);
    expect(result.success).toBe(true);
  });
});

describe("createOrderSchema — Laat ons schrijven", () => {
  const base = { websiteProductId: "cmufc96vx0011q6ire5e2bta7", writeForMe: true };
  it("needs no title or text, but at least one complete link", () => {
    expect(createOrderSchema.safeParse({ ...base, briefLinks: [{ anchor: "isolatie", url: "https://a.nl/x" }] }).success).toBe(true);
    expect(createOrderSchema.safeParse({ ...base, briefLinks: [] }).success).toBe(false);
    expect(createOrderSchema.safeParse({ ...base, briefLinks: [{ anchor: "isolatie", url: "a.nl" }] }).success).toBe(false);
  });
  it("ignores an empty optional second link", () => {
    const r = createOrderSchema.safeParse({
      ...base,
      briefLinks: [
        { anchor: "isolatie", url: "https://a.nl/x" },
        { anchor: "", url: "" },
      ],
    });
    expect(r.success).toBe(true);
  });
});
