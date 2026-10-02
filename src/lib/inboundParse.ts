import sanitizeHtml from "sanitize-html";
import { sanitizeArticleBody } from "@/lib/sanitizeArticle";

// Reading an order mail: which of our sites it's about, the article from a
// Word attachment (as HTML from mammoth) and the links (anchor + URL).
// Pure functions, so they're tested without a mailbox.

export type FoundLink = { anchor: string; url: string };

const plain = (html: string) =>
  sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// The first of our domains named in the texts, in the order given (subject
// before body before attachment names). "a2f.nl" doesn't match "xa2f.nl" or
// "a2f.nl.example.com", but does at the end of a sentence ("op a2f.nl.").
// A mail address isn't a site: "info@nugevonden.nl" in a forwarded "Aan:"
// line doesn't count as nugevonden.nl.
export function findDomain(texts: string[], domains: string[]): string | null {
  for (const text of texts) {
    const hay = text.toLowerCase();
    let best: { domain: string; at: number } | null = null;
    for (const domain of domains) {
      const re = new RegExp(`(^|[^a-z0-9.@-])(www\\.)?${escapeRe(domain.toLowerCase())}($|[^a-z0-9.-]|\\.(?![a-z0-9]))`);
      const m = re.exec(hay);
      if (m && (!best || m.index < best.at)) best = { domain, at: m.index };
    }
    if (best) return best.domain;
  }
  return null;
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
};

// Links pointing at one of our own sites aren't the customer's links.
const isOwn = (url: string, ownDomains: string[]) => {
  const host = hostOf(url);
  return host !== null && ownDomains.some((d) => host === d.toLowerCase() || host.endsWith(`.${d.toLowerCase()}`));
};

// The article from the Word file: the first heading (or a short first line)
// is the title, the rest the text; links keep their anchor text.
export function readArticle(
  html: string,
  ownDomains: string[] = []
): { title: string | null; body: string; links: FoundLink[] } {
  const clean = sanitizeArticleBody(html);
  let title: string | null = null;
  let body = clean;
  const heading = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i.exec(clean);
  const firstPara = /^\s*<p[^>]*>([\s\S]*?)<\/p>/i.exec(clean);
  if (heading && plain(heading[1])) {
    title = plain(heading[1]);
    body = clean.replace(heading[0], "");
  } else if (firstPara) {
    const text = plain(firstPara[1]);
    if (text && text.length <= 120 && !/[.!?:]$/.test(text)) {
      title = text;
      body = clean.replace(firstPara[0], "");
    }
  }
  const links: FoundLink[] = [];
  for (const m of Array.from(body.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi))) {
    const url = m[1].replace(/&amp;/g, "&");
    if (!/^https?:\/\//i.test(url) || isOwn(url, ownDomains)) continue;
    links.push({ anchor: plain(m[2]), url });
  }
  return { title, body: body.trim(), links };
}

const URL_RE = /https?:\/\/[^\s<>"')]+/gi;
const LABEL_RE = /^(anker(tekst)?|anchor( text)?|link(tekst)?|tekst|zoekwoord|keyword)\s*[:=-]\s*/i;

// Links written out in the mail itself, e.g.
//   regenton kopen - https://tuinwinkel.nl/regentonnen
//   Anker: "regenton kopen" → https://tuinwinkel.nl/regentonnen
//   Ankertekst: regenton kopen
//   URL: https://tuinwinkel.nl/regentonnen
export function linksFromText(text: string, ownDomains: string[] = []): FoundLink[] {
  const paired = pairedLists(text, ownDomains);
  if (paired) return paired;
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const links: FoundLink[] = [];
  let pendingAnchor: string | null = null;
  for (const line of lines) {
    if (/^>/.test(line)) continue; // quoted earlier mail
    const urls = line.match(URL_RE) ?? [];
    if (urls.length === 0) {
      if (LABEL_RE.test(line)) pendingAnchor = cleanAnchor(line.replace(LABEL_RE, ""));
      continue;
    }
    for (const raw of urls) {
      const url = raw.replace(/[.,;:]+$/, "");
      if (isOwn(url, ownDomains) || links.some((l) => l.url === url)) continue;
      const before = cleanAnchor(line.slice(0, line.indexOf(raw)).replace(/^(url|link|doel(-?url)?)\s*[:=-]\s*$/i, ""));
      const quoted = /["“”'‘’]([^"“”'‘’]{2,80})["“”'‘’]/.exec(line)?.[1];
      links.push({ anchor: quoted ?? (before || pendingAnchor || ""), url });
      pendingAnchor = null;
    }
  }
  return links;
}

// A "Label: value" line starts a new part of the mail.
const LABEL_LINE = /^[A-Za-zÀ-ÿ ()/-]{2,40}:/;
const LINKS_LABEL = /^\s*(links?|urls?|doel-?urls?|landingspagina'?s?)\s*:/i;
const ANCHORS_LABEL = /^\s*(link\s*-?\s*teksten?|anker\s*-?\s*teksten?|ankers?|anchors?( texts?)?|linkteksten|ankerteksten)\s*:/i;

// The lines of one labelled part: the label line and the ones below it, up to
// an empty line or the next label.
function section(lines: string[], label: RegExp): string | null {
  const at = lines.findIndex((l) => label.test(l));
  if (at === -1) return null;
  const parts = [lines[at].replace(label, "")];
  for (const line of lines.slice(at + 1)) {
    const t = line.trim();
    if (!t || (LABEL_LINE.test(t) && !/^https?:/i.test(t))) break;
    parts.push(line);
  }
  return parts.join("\n");
}

// Links and anchors given as two lists, the way some agencies send them:
//   Links: https://a.nl/; https://a.nl/b
//   Linkteksten: 1: studiekeuze 2: studiefinanciering
// The first anchor goes with the first link, and so on.
function pairedLists(text: string, ownDomains: string[]): FoundLink[] | null {
  const lines = text.split(/\r?\n/).filter((l) => !/^\s*>/.test(l));
  const linkPart = section(lines, LINKS_LABEL);
  const anchorPart = section(lines, ANCHORS_LABEL);
  if (!linkPart || !anchorPart) return null;
  const urls = (linkPart.match(URL_RE) ?? [])
    .map((u) => u.replace(/[.,;:]+$/, ""))
    .filter((u, i, all) => !isOwn(u, ownDomains) && all.indexOf(u) === i);
  if (urls.length === 0) return null;
  const numbered = anchorPart.split(/(?:^|\s)\d{1,2}\s*[:.)]\s+/).map((a) => a.trim());
  const anchors = (numbered.length > 1 ? numbered.slice(1) : anchorPart.split(/[;,\n]/))
    .map((a) => cleanAnchor(a.replace(/[;,]+$/, "")))
    .filter(Boolean);
  return urls.map((url, i) => ({ anchor: anchors[i] ?? "", url }));
}

// The site the article is for, when the mail says so on its own line
// ("Website plaatsing: digikeur.nl"), including the line below it.
export function placementLine(text: string): string | null {
  const lines = text.split(/\r?\n/);
  const at = lines.findIndex((l) => /^\s*(website\s*-?\s*)?(plaatsing|publicatie)(\s*-?\s*site)?\s*:|^\s*(website|site|plaatsen op)\s*:/i.test(l));
  return at === -1 ? null : `${lines[at]}\n${lines[at + 1] ?? ""}`;
}

function cleanAnchor(s: string): string {
  return s
    .replace(LABEL_RE, "")
    .replace(/[-–—→>:=|]+\s*$/, "")
    .replace(/^["“”'‘’]+|["“”'‘’]+$/g, "")
    .trim()
    .slice(0, 120);
}

export type Forwarded = { fromEmail: string; fromName: string | null; subject: string | null };

const FORWARD_MARKERS = [
  /-{3,}\s*(forwarded message|doorgestuurd bericht|doorgestuurd e-?mailbericht|original message|oorspronkelijk bericht)\s*-{3,}/i,
  /^\s*(begin forwarded message|begin doorgestuurd bericht)\s*:/im,
  /^_{10,}\s*$/m, // Outlook draws a line above "Van: … Verzonden: …"
];
const FROM_RE = /^\s*\*?(from|van)\s*:\*?\s*(.+)$/im;
const SUBJECT_RE = /^\s*\*?(subject|onderwerp)\s*:\*?\s*(.+)$/im;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

// A mail forwarded to the order mailbox: the original sender and subject
// from the header block the mail program puts in the text (Gmail, Outlook,
// Apple Mail, in Dutch or English). The first sender that isn't one of your
// own addresses counts, so a forward of your own reply still finds the
// customer. Null when it isn't a forward.
export function findForwarded(text: string, ownEmails: string[] = []): Forwarded | null {
  let start = -1;
  for (const marker of FORWARD_MARKERS) {
    const m = marker.exec(text);
    if (m && (start === -1 || m.index < start)) start = m.index;
  }
  // Outlook without a line: "Van: …" directly followed by "Verzonden:/Sent:".
  if (start === -1) {
    const m = /^\s*\*?(from|van)\s*:.*\n\s*\*?(sent|verzonden|date|datum)\s*:/im.exec(text);
    if (m) start = m.index;
  }
  if (start === -1) return null;
  const own = ownEmails.map((e) => e.toLowerCase());
  const rest = text.slice(start);
  for (const m of Array.from(rest.matchAll(new RegExp(FROM_RE.source, "gim")))) {
    const from = m[2].trim();
    const email = EMAIL_RE.exec(from)?.[0]?.toLowerCase();
    if (!email || own.includes(email)) continue;
    const name = from
      .replace(/<[^>]*>|\[mailto:[^\]]*\]|\([^)]*@[^)]*\)/gi, "")
      .replace(EMAIL_RE, "")
      .replace(/["']/g, "")
      .trim();
    const block = rest.slice(m.index ?? 0, (m.index ?? 0) + 1500);
    return { fromEmail: email, fromName: name || null, subject: SUBJECT_RE.exec(block)?.[2]?.trim() || null };
  }
  return null;
}

// "Tim van All the way up" → name Tim, company All the way up.
export function splitSenderName(fromName: string | null): { name: string; company: string } {
  const full = (fromName ?? "").trim();
  const m = /^(.+?)\s+(?:van|from|\||-|–|@)\s+(.+)$/i.exec(full);
  return m ? { name: m[1].trim(), company: m[2].trim() } : { name: full, company: "" };
}

// The customer's own words from a mail, for a short preview: without the
// forwarded header block, quoted lines ("> …") and what follows "Op … schreef:".
export function mailSnippet(text: string): string {
  let body = text;
  const fwd = /^(-{3,}.*(forwarded|doorgestuurd|original|oorspronkelijk).*-{3,}|begin (forwarded|doorgestuurd) (message|bericht):)\s*$/im.exec(body);
  if (fwd) {
    const after = body.slice(fwd.index + fwd[0].length);
    const blank = after.search(/\n\s*\n/);
    body = blank === -1 ? after : after.slice(blank);
  }
  const lines: string[] = [];
  for (const line of body.split(/\r?\n/)) {
    if (/^\s*(op|on)\s.+(schreef|wrote)\s*.*:\s*$/i.test(line)) break;
    if (/^\s*>/.test(line)) continue;
    lines.push(line);
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
