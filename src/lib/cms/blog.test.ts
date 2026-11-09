import { describe, expect, it } from "vitest";
import { autoExcerpt, parseInline, postInputSchema, readingMinutes, safeLink, slugify, stripInline, type Block } from "./blog";

describe("slugify", () => {
  it("maakt een nette url-slug", () => {
    expect(slugify("Waarom AI-assistenten naar backlinks kijken")).toBe("waarom-ai-assistenten-naar-backlinks-kijken");
    expect(slugify("  Prijzen & kosten: €35!  ")).toBe("prijzen-en-kosten-35");
    expect(slugify("Café Zürich")).toBe("cafe-zurich");
    expect(slugify("---")).toBe("");
  });
});

describe("parseInline", () => {
  it("herkent vet, cursief en links", () => {
    expect(parseInline("Dit is **vet** en *cursief* met een [link](https://publito.nl).")).toEqual([
      { kind: "text", text: "Dit is " },
      { kind: "strong", children: [{ kind: "text", text: "vet" }] },
      { kind: "text", text: " en " },
      { kind: "em", children: [{ kind: "text", text: "cursief" }] },
      { kind: "text", text: " met een " },
      { kind: "link", href: "https://publito.nl", children: [{ kind: "text", text: "link" }] },
      { kind: "text", text: "." },
    ]);
  });

  it("maakt van een onveilige link gewone tekst", () => {
    expect(parseInline("[klik](javascript:alert)")).toEqual([{ kind: "text", text: "klik" }]);
    expect(parseInline("[x](http://onveilig.nl)")).toEqual([{ kind: "text", text: "x" }]);
    expect(safeLink("/blog")).toBe("/blog");
    expect(safeLink("//evil")).toBeNull();
    expect(safeLink("mailto:a@b.nl")).toBe("mailto:a@b.nl");
  });

  it("laat gewone tekst met sterretjes staan", () => {
    expect(parseInline("2 * 3 = 6")).toEqual([{ kind: "text", text: "2 * 3 = 6" }]);
  });

  it("stripInline haalt de opmaak weg", () => {
    expect(stripInline("**a** *b* [c](https://x.nl)")).toBe("a b c");
  });
});

describe("blokken", () => {
  const blocks: Block[] = [
    { id: "a", type: "heading", level: 2, text: "Kop" },
    { id: "b", type: "paragraph", text: "Eerste **alinea** met genoeg woorden om iets te zeggen." },
    { id: "c", type: "list", ordered: false, items: ["een", "twee"] },
    { id: "d", type: "image", mediaId: null, caption: "", alt: "" },
  ];

  it("berekent leestijd en samenvatting", () => {
    expect(readingMinutes(blocks)).toBe(1);
    expect(autoExcerpt(blocks)).toBe("Eerste alinea met genoeg woorden om iets te zeggen.");
    expect(autoExcerpt([{ id: "x", type: "paragraph", text: "w ".repeat(200) }]).endsWith("…")).toBe(true);
  });

  it("valideert invoer en weigert verkeerde slugs en bloktypen", () => {
    const ok = postInputSchema.safeParse({
      title: "T",
      slug: "goede-slug",
      excerpt: "",
      content: blocks,
      categories: [],
      featuredImageId: null,
      seoTitle: "",
      seoDescription: "",
      focusKeyword: "",
      authorName: "",
      publishedAt: null,
    });
    expect(ok.success).toBe(true);
    expect(postInputSchema.safeParse({ ...ok.data, slug: "Foute Slug" }).success).toBe(false);
    expect(postInputSchema.safeParse({ ...ok.data, content: [{ id: "z", type: "script", text: "x" }] }).success).toBe(false);
    expect(postInputSchema.safeParse({ ...ok.data, content: [{ id: "z", type: "heading", level: 5, text: "x" }] }).success).toBe(false);
  });
});
