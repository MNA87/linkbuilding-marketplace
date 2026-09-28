import { describe, expect, it } from "vitest";
import { blogUrlTemplate, fillBlogUrl, wpSlugify, articleSlugOf, articleUrlPrefix } from "./wpSlug";

describe("wpSlugify", () => {
  it("lowercases and hyphenates", () => {
    expect(wpSlugify("5 Tips voor een Lagere Energierekening")).toBe("5-tips-voor-een-lagere-energierekening");
  });

  it("strips accents and punctuation like WordPress", () => {
    expect(wpSlugify("Café-eigenaren: wat nú?")).toBe("cafe-eigenaren-wat-nu");
    expect(wpSlugify("Jan's tuin & huis")).toBe("jans-tuin-huis");
    expect(wpSlugify("Straße")).toBe("strasse");
  });

  it("turns slashes, dots and dashes into single hyphens", () => {
    expect(wpSlugify("Web 2.0 / AI — de toekomst")).toBe("web-2-0-ai-de-toekomst");
  });

  it("returns empty for a title without usable characters", () => {
    expect(wpSlugify("!!! ???")).toBe("");
  });
});

describe("blogUrlTemplate", () => {
  it("builds a template for a postname-only structure", () => {
    expect(blogUrlTemplate("https://a2f.nl", "/%postname%/")).toBe("https://a2f.nl/%postname%/");
    expect(blogUrlTemplate("https://a2f.nl/", "/blog/%postname%/")).toBe("https://a2f.nl/blog/%postname%/");
  });

  it("refuses structures that can't be predicted up front", () => {
    expect(blogUrlTemplate("https://nugevonden.nl", "/%category%/%postname%/")).toBeNull();
    expect(blogUrlTemplate("https://a2f.nl", "/%year%/%monthnum%/%postname%/")).toBeNull();
    expect(blogUrlTemplate("https://a2f.nl", "")).toBeNull();
    expect(blogUrlTemplate(null, "/%postname%/")).toBeNull();
  });
});

describe("fillBlogUrl", () => {
  it("fills in the slug", () => {
    expect(fillBlogUrl("https://a2f.nl/%postname%/", "Beste service")).toBe("https://a2f.nl/beste-service/");
  });

  it("returns null while there's no usable title yet", () => {
    expect(fillBlogUrl("https://a2f.nl/%postname%/", "  ")).toBeNull();
  });
});

describe("articleSlugOf", () => {
  it("uses the admin's own slug when there is one", () => {
    expect(articleSlugOf({ articleSlug: "Zonnepanelen Tips", articleTitle: "Iets anders" })).toBe("zonnepanelen-tips");
  });

  it("falls back to the title", () => {
    expect(articleSlugOf({ articleSlug: null, articleTitle: "Zonnepanelen: waar let je op?" })).toBe(
      "zonnepanelen-waar-let-je-op"
    );
  });
});

describe("articleUrlPrefix", () => {
  it("is the domain for a plain post-name structure", () => {
    expect(articleUrlPrefix("https://a2f.nl", "/%postname%/", null)).toBe("https://a2f.nl/");
  });

  it("puts the chosen category in when the URLs have one", () => {
    expect(articleUrlPrefix("https://nugevonden.nl/", "/%category%/%postname%/", "Online Marketing")).toBe(
      "https://nugevonden.nl/online-marketing/"
    );
  });

  it("can't tell without a category, or with dates in the URL", () => {
    expect(articleUrlPrefix("https://nugevonden.nl", "/%category%/%postname%/", null)).toBeNull();
    expect(articleUrlPrefix("https://a.nl", "/%year%/%postname%/", null)).toBeNull();
  });
});

describe("fixed article URL base", () => {
  it("wins over the permalink setting", () => {
    expect(articleUrlPrefix("https://nugevonden.nl", "/%category%/%postname%/", null, "https://nugevonden.nl/internet/")).toBe(
      "https://nugevonden.nl/internet/"
    );
    expect(blogUrlTemplate(null, null, "https://enqueteplein.nl/algemeen")).toBe(
      "https://enqueteplein.nl/algemeen/%postname%/"
    );
  });
});
