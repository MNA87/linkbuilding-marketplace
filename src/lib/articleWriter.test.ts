import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ArticleWriterError,
  buildArticlePrompt,
  missingBriefLinks,
  parseArticleResponse,
  writeArticle,
} from "./articleWriter";

const links = [
  { anchor: "duurzame tuinmeubelen", url: "https://tuin.nl/meubels" },
  { anchor: "loungeset", url: "https://tuin.nl/lounge?kleur=grijs&maat=l" },
];

describe("buildArticlePrompt", () => {
  it("names the site, category and every link", () => {
    const { user } = buildArticlePrompt({ domain: "nugevonden.nl", category: "Wonen", links });
    expect(user).toContain("nugevonden.nl");
    expect(user).toContain('rubriek "Wonen"');
    expect(user).toContain('"duurzame tuinmeubelen" → https://tuin.nl/meubels');
    expect(user).toContain('"loungeset" → https://tuin.nl/lounge?kleur=grijs&maat=l');
    // Anchors must read as part of the sentence, not pasted in as-is.
    expect(user).toContain("pas de hoofdletters aan de zin aan");
  });
});

describe("parseArticleResponse", () => {
  it("sanitizes the html and caps the title", () => {
    const result = parseArticleResponse(
      JSON.stringify({ title: "  " + "a".repeat(90), html: '<h2>Kop</h2><p>Tekst</p><script>alert(1)</script><img src="x">' })
    );
    expect(result.title).toHaveLength(70);
    expect(result.html).toBe("<h2>Kop</h2><p>Tekst</p>");
  });
  it("rejects anything that isn't a title + html", () => {
    expect(() => parseArticleResponse("geen json")).toThrow(ArticleWriterError);
    expect(() => parseArticleResponse(JSON.stringify({ title: "x" }))).toThrow(ArticleWriterError);
    expect(() => parseArticleResponse(JSON.stringify({ title: "", html: "<p>x</p>" }))).toThrow(ArticleWriterError);
  });
});

describe("missingBriefLinks", () => {
  it("finds links, also with an escaped query string or trailing slash", () => {
    const html =
      '<p>Kijk naar <a href="https://tuin.nl/meubels/">duurzame tuinmeubelen</a> en een ' +
      '<a href="https://tuin.nl/lounge?kleur=grijs&amp;maat=l">loungeset</a>.</p>';
    expect(missingBriefLinks(html, links)).toEqual([]);
    expect(missingBriefLinks("<p>Niks</p>", links)).toEqual(links);
  });
});

describe("writeArticle", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("says so when no key is set", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    await expect(writeArticle({ domain: "a.nl", category: null, links })).rejects.toThrow("OPENAI_API_KEY");
  });

  it("asks OpenAI for JSON and returns the cleaned draft", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubEnv("OPENAI_MODEL", "");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ title: "Titel", html: "<p>Hoi</p>" }) } }],
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(writeArticle({ domain: "a.nl", category: null, links })).resolves.toEqual({
      title: "Titel",
      html: "<p>Hoi</p>",
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer sk-test");
    const sent = JSON.parse(init.body);
    expect(sent.model).toBe("gpt-5-mini");
    expect(sent.response_format).toEqual({ type: "json_object" });
  });

  it("turns API errors into a readable message", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 401 })));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(writeArticle({ domain: "a.nl", category: null, links })).rejects.toThrow("niet geaccepteerd");
  });
});
