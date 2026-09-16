import { describe, it, expect } from "vitest";
import { createOrderSchema } from "./order";

const base = {
  websiteProductId: "clxxxxxxxxxxxxxxxxxxxxxxx",
  targetUrl: "https://klant.nl/pagina",
  anchorText: "anker",
  contentSource: "PUBLISHER" as const,
};

describe("createOrderSchema", () => {
  it("accepts a valid order with an existing project", () => {
    const result = createOrderSchema.safeParse({ ...base, projectId: "clyyyyyyyyyyyyyyyyyyyyyyy" });
    expect(result.success).toBe(true);
  });

  it("accepts a valid order with a new project name", () => {
    const result = createOrderSchema.safeParse({ ...base, newProjectName: "Nieuw project" });
    expect(result.success).toBe(true);
  });

  it("rejects when neither an existing project nor a new project name is given", () => {
    const result = createOrderSchema.safeParse({ ...base });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid target URL", () => {
    const result = createOrderSchema.safeParse({
      ...base,
      newProjectName: "xy",
      targetUrl: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("requires article title/body when the customer supplies the content", () => {
    const result = createOrderSchema.safeParse({
      ...base,
      newProjectName: "xy",
      contentSource: "CUSTOMER",
    });
    expect(result.success).toBe(false);
  });

  it("accepts customer-supplied content when title/body are present", () => {
    const result = createOrderSchema.safeParse({
      ...base,
      newProjectName: "xy",
      contentSource: "CUSTOMER",
      articleTitle: "Titel",
      articleBody: "Tekst",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty rich text editor body (just an empty paragraph tag)", () => {
    const result = createOrderSchema.safeParse({
      ...base,
      newProjectName: "xy",
      contentSource: "CUSTOMER",
      articleTitle: "Titel",
      articleBody: "<p></p>",
    });
    expect(result.success).toBe(false);
  });

  it("accepts rich text editor HTML with real text content", () => {
    const result = createOrderSchema.safeParse({
      ...base,
      newProjectName: "xy",
      contentSource: "CUSTOMER",
      articleTitle: "Titel",
      articleBody: "<p>Een <strong>mooi</strong> artikel met een <a href=\"https://klant.nl/pagina\">link</a>.</p>",
    });
    expect(result.success).toBe(true);
  });
});
