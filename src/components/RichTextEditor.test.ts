import { describe, expect, it } from "vitest";
import { normalizeLinkUrl } from "./RichTextEditor";

describe("normalizeLinkUrl", () => {
  it("adds https:// when the scheme is missing", () => {
    expect(normalizeLinkUrl(" www.voorbeeld.nl ")).toBe("https://www.voorbeeld.nl");
    expect(normalizeLinkUrl("voorbeeld.nl/pagina")).toBe("https://voorbeeld.nl/pagina");
    expect(normalizeLinkUrl("//voorbeeld.nl")).toBe("https://voorbeeld.nl");
  });
  it("keeps an address that already has a scheme", () => {
    expect(normalizeLinkUrl("http://voorbeeld.nl")).toBe("http://voorbeeld.nl");
    expect(normalizeLinkUrl("mailto:info@voorbeeld.nl")).toBe("mailto:info@voorbeeld.nl");
  });
  it("is empty for empty input", () => {
    expect(normalizeLinkUrl("  ")).toBe("");
  });
});
