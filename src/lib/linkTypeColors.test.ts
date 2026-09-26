import { describe, expect, it } from "vitest";
import { DEFAULT_LINK_TYPE_COLORS, linkTypeColorVars } from "./linkTypeColors";

describe("linkTypeColorVars", () => {
  it("sets a colour and a light tint per kind of link", () => {
    const vars = linkTypeColorVars({ blog: "#2563eb", homepage: "#0d9488" }) as Record<string, string>;
    expect(vars["--type-blog"]).toBe("#2563eb");
    expect(vars["--type-blog-soft"]).toBe("#e9effd");
    expect(vars["--type-homepage"]).toBe("#0d9488");
  });

  it("falls back to the defaults for an invalid colour", () => {
    const vars = linkTypeColorVars({ blog: "blauw", homepage: "#123456" }) as Record<string, string>;
    expect(vars["--type-blog"]).toBe(DEFAULT_LINK_TYPE_COLORS.blog);
    expect(vars["--type-homepage"]).toBe("#123456");
  });
});
