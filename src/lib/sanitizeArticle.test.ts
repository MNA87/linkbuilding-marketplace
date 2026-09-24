import { describe, expect, it } from "vitest";
import { sanitizeArticleBody } from "./sanitizeArticle";

describe("sanitizeArticleBody", () => {
  it("keeps strikethrough and horizontal rules from the editor", () => {
    expect(sanitizeArticleBody("<p><s>oud</s> nieuw</p><hr><p>verder</p>")).toBe(
      "<p><s>oud</s> nieuw</p><hr /><p>verder</p>"
    );
  });

  it("still strips scripts and event handlers", () => {
    expect(sanitizeArticleBody('<p onclick="x()">hoi</p><script>alert(1)</script>')).toBe("<p>hoi</p>");
  });
});
