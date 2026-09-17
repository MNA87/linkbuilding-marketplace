import { describe, it, expect } from "vitest";
import { buildContentWithLink, extractLinkFromBody } from "./wordpress";

describe("buildContentWithLink", () => {
  it("leaves the body alone when the link is already there", () => {
    const body = '<p>Een <a href="https://klant.nl/pagina">mooie pagina</a>.</p>';
    expect(buildContentWithLink(body, "https://klant.nl/pagina", "mooie pagina")).toBe(body);
  });

  it("wraps the anchor text where it already appears in the body", () => {
    const body = "<p>Kijk eens naar deze mooie pagina.</p>";
    expect(buildContentWithLink(body, "https://klant.nl/pagina", "mooie pagina")).toBe(
      '<p>Kijk eens naar deze <a href="https://klant.nl/pagina">mooie pagina</a>.</p>'
    );
  });

  it("appends the link when neither the URL nor the anchor text appear", () => {
    const body = "<p>Een artikel zonder link.</p>";
    expect(buildContentWithLink(body, "https://klant.nl/pagina", "mooie pagina")).toBe(
      '<p>Een artikel zonder link.</p>\n\n<p><a href="https://klant.nl/pagina">mooie pagina</a></p>'
    );
  });

  it("leaves the body alone when there's no target URL/anchor text at all", () => {
    const body = "<p>Een artikel zonder link, en dat is prima.</p>";
    expect(buildContentWithLink(body, null, null)).toBe(body);
  });
});

describe("extractLinkFromBody", () => {
  it("finds the target URL and anchor text of the first link", () => {
    const body = '<p>Een <a href="https://klant.nl/pagina">mooie pagina</a>.</p>';
    expect(extractLinkFromBody(body)).toEqual({ targetUrl: "https://klant.nl/pagina", anchorText: "mooie pagina" });
  });

  it("returns null when there is no link at all", () => {
    const body = "<p>Geen link hier.</p>";
    expect(extractLinkFromBody(body)).toBeNull();
  });

  it("returns null when the link has no visible text", () => {
    const body = '<p>Een <a href="https://klant.nl/pagina"></a> link.</p>';
    expect(extractLinkFromBody(body)).toBeNull();
  });

  it("strips inline formatting tags from the anchor text", () => {
    const body = '<p>Een <a href="https://klant.nl/pagina"><strong>mooie</strong> pagina</a>.</p>';
    expect(extractLinkFromBody(body)).toEqual({ targetUrl: "https://klant.nl/pagina", anchorText: "mooie pagina" });
  });
});
