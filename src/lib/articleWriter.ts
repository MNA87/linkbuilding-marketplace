import { sanitizeArticleBody } from "@/lib/sanitizeArticle";
import { TITLE_MAX_LENGTH } from "@/lib/validations/order";
import type { BriefLink } from "@/lib/writingService";

// "Schrijf met AI" for "Laat ons schrijven" orders: a first draft from
// OpenAI that the admin reads, edits and then publishes like any article.
// The key lives only in the environment (Railway), never in code.
// OPENAI_BASE_URL is only for pointing at a stand-in during tests.
const apiUrl = () => `${(process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "")}/chat/completions`;
const DEFAULT_MODEL = "gpt-5-mini";

export function articleWriterConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export class ArticleWriterError extends Error {}

export type ArticleBrief = {
  domain: string;
  category: string | null;
  links: BriefLink[];
};

export function buildArticlePrompt(brief: ArticleBrief): { system: string; user: string } {
  const system = [
    "Je bent een ervaren Nederlandse webredacteur.",
    "Je schrijft informatieve blogartikelen die lezers echt iets bijbrengen: concreet, goed leesbaar, geen reclametaal en geen clichés.",
    "Je antwoordt uitsluitend met JSON.",
  ].join(" ");

  const links = brief.links
    .map((l, i) => `${i + 1}. ankertekst "${l.anchor}" → ${l.url}`)
    .join("\n");

  const user = [
    `Schrijf een Nederlands blogartikel voor de website ${brief.domain}${
      brief.category ? `, rubriek "${brief.category}"` : ""
    }.`,
    "",
    brief.links.length > 1 ? "Verwerk deze links in de tekst:" : "Verwerk deze link in de tekst:",
    links,
    "",
    "Eisen:",
    "- Kies zelf een onderwerp dat logisch aansluit bij de ankertekst(en) en de website.",
    "- 500 tot 700 woorden.",
    `- Een pakkende titel van maximaal ${TITLE_MAX_LENGTH} tekens.`,
    "- Elke link precies één keer, natuurlijk in een zin, als <a href=\"URL\">ankertekst</a> met exact de gegeven ankertekst en URL. Niet in de eerste alinea en niet in een kop.",
    "- Opbouw: een korte inleiding, daarna tussenkoppen (<h2>) met alinea's (<p>); een opsomming (<ul><li>) mag waar dat helpt.",
    "- Gebruik alleen <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em> en <a>. Geen <h1>, geen afbeeldingen, geen andere links.",
    "- Noem niet dat het artikel gesponsord is en spreek de lezer aan met 'je'.",
    "",
    'Antwoord als JSON: {"title": "...", "html": "..."}',
  ].join("\n");

  return { system, user };
}

// Pulls the draft out of the model's answer and makes it safe to store:
// same sanitizing as a customer's own article, title within the limit.
export function parseArticleResponse(content: string): { title: string; html: string } {
  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch {
    throw new ArticleWriterError("De AI gaf geen bruikbaar antwoord. Probeer het opnieuw.");
  }
  const { title, html } = (data ?? {}) as { title?: unknown; html?: unknown };
  if (typeof title !== "string" || typeof html !== "string" || !title.trim() || !html.trim()) {
    throw new ArticleWriterError("De AI gaf geen bruikbaar antwoord. Probeer het opnieuw.");
  }
  return {
    title: title.trim().replace(/\s+/g, " ").slice(0, TITLE_MAX_LENGTH),
    html: sanitizeArticleBody(html),
  };
}

// Which of the briefing's links are (not) in the text, so the admin sees at
// a glance whether the customer gets what they paid for.
export function missingBriefLinks(html: string, links: BriefLink[]): BriefLink[] {
  const hrefs = Array.from(html.matchAll(/<a\s[^>]*href="([^"]*)"/gi), (m) =>
    m[1].replace(/&amp;/g, "&").replace(/\/$/, "")
  );
  return links.filter((l) => !hrefs.includes(l.url.replace(/\/$/, "")));
}

export async function writeArticle(brief: ArticleBrief): Promise<{ title: string; html: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new ArticleWriterError("OpenAI is nog niet gekoppeld: OPENAI_API_KEY ontbreekt.");

  const { system, user } = buildArticlePrompt(brief);
  let res: Response;
  try {
    res = await fetch(apiUrl(), {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (err) {
    console.error("OpenAI request failed", err);
    throw new ArticleWriterError("OpenAI is niet bereikbaar. Probeer het zo opnieuw.");
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`OpenAI returned ${res.status}`, detail.slice(0, 500));
    throw new ArticleWriterError(
      res.status === 401
        ? "De OpenAI-sleutel wordt niet geaccepteerd."
        : res.status === 429
          ? "OpenAI-limiet bereikt (of tegoed op). Probeer het later opnieuw."
          : "OpenAI gaf een fout. Probeer het opnieuw."
    );
  }

  const body = (await res.json().catch(() => null)) as {
    choices?: { message?: { content?: string } }[];
  } | null;
  return parseArticleResponse(body?.choices?.[0]?.message?.content ?? "");
}
