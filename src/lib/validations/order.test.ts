import { describe, it, expect } from "vitest";
import { createOrderSchema } from "./order";

const base = {
  websiteProductId: "clxxxxxxxxxxxxxxxxxxxxxxx",
  targetUrl: "https://klant.nl/pagina",
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

  it("rejects an invalid target URL", () => {
    const result = createOrderSchema.safeParse({ ...base, targetUrl: "niet-een-url" });
    expect(result.success).toBe(false);
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
