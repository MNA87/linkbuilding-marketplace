import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { articleToDocx } from "./articleDocx";

describe("articleToDocx", () => {
  it("makes a Word file with the title, text and clickable links, without images", async () => {
    const buffer = await articleToDocx({
      title: "Studeren zonder geldzorgen",
      note: "Preview voor All the way up · a2f.nl · versie 1",
      html: '<h2>Begin bij jezelf</h2><p>Een goede <a href="https://www.studiekeuzelab.nl/">studiekeuze</a> &amp; <strong>planning</strong>.</p><ul><li>Open dagen</li></ul><p><img src="x.jpg"></p>',
    });
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file("word/document.xml")!.async("string");
    const rels = await zip.file("word/_rels/document.xml.rels")!.async("string");
    expect(xml).toContain("Studeren zonder geldzorgen");
    expect(xml).toContain("Preview voor All the way up");
    expect(xml).toContain("Begin bij jezelf");
    expect(xml).toContain("studiekeuze");
    expect(xml).toContain("&amp; ");
    expect(xml).toContain("Open dagen");
    expect(xml).toContain("w:hyperlink");
    expect(rels).toContain("https://www.studiekeuzelab.nl/");
    expect(Object.keys(zip.files).some((f) => f.startsWith("word/media/"))).toBe(false);
  });
});
