import { z } from "zod";

// Blog van de publieke site: bloktypen, validatie en pure hulpjes. Geen
// database hier (dat zit in blogContent.ts), zodat dit los te testen is.

export const BLOCK_TYPES = ["paragraph", "heading", "image", "list", "quote", "button"] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

const id = z.string().min(1).max(40);
export const blockSchema = z.discriminatedUnion("type", [
  z.object({ id, type: z.literal("paragraph"), text: z.string().max(20000) }),
  z.object({ id, type: z.literal("heading"), level: z.union([z.literal(2), z.literal(3)]), text: z.string().max(500) }),
  z.object({
    id,
    type: z.literal("image"),
    mediaId: z.string().max(60).nullable(),
    caption: z.string().max(500),
    alt: z.string().max(300),
  }),
  z.object({ id, type: z.literal("list"), ordered: z.boolean(), items: z.array(z.string().max(2000)).max(100) }),
  z.object({ id, type: z.literal("quote"), text: z.string().max(5000), cite: z.string().max(200) }),
  z.object({ id, type: z.literal("button"), label: z.string().max(120), href: z.string().max(500) }),
]);
export type Block = z.infer<typeof blockSchema>;

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const postInputSchema = z.object({
  title: z.string().max(300),
  slug: z.string().max(120).regex(SLUG_RE, "Gebruik alleen kleine letters, cijfers en streepjes"),
  excerpt: z.string().max(1000),
  content: z.array(blockSchema).max(500),
  categories: z.array(z.string().max(60)).max(20),
  featuredImageId: z.string().max(60).nullable(),
  seoTitle: z.string().max(200),
  seoDescription: z.string().max(400),
  focusKeyword: z.string().max(120),
  authorName: z.string().max(120),
  publishedAt: z.string().datetime().nullable(),
});
export type PostInput = z.infer<typeof postInputSchema>;

export const categoryNameSchema = z.string().trim().min(2, "Minimaal 2 tekens").max(60);

/** "Waarom AI naar backlinks kijkt" → "waarom-ai-naar-backlinks-kijkt" */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " en ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

export function newBlockId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function emptyBlock(type: BlockType): Block {
  const b = newBlockId();
  switch (type) {
    case "paragraph":
      return { id: b, type, text: "" };
    case "heading":
      return { id: b, type, level: 2, text: "" };
    case "image":
      return { id: b, type, mediaId: null, caption: "", alt: "" };
    case "list":
      return { id: b, type, ordered: false, items: [""] };
    case "quote":
      return { id: b, type, text: "", cite: "" };
    case "button":
      return { id: b, type, label: "", href: "" };
  }
}

/** Alle lopende tekst van een bericht, voor leestijd en een automatische samenvatting. */
export function plainText(blocks: Block[]): string {
  return blocks
    .map((b) => {
      switch (b.type) {
        case "paragraph":
        case "heading":
        case "quote":
          return stripInline(b.text);
        case "list":
          return b.items.map(stripInline).join(" ");
        case "image":
          return b.caption;
        case "button":
          return "";
      }
    })
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function readingMinutes(blocks: Block[]): number {
  const words = plainText(blocks).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

export function autoExcerpt(blocks: Block[], max = 160): string {
  const first = blocks.find((b) => b.type === "paragraph" && b.text.trim());
  const text = stripInline(first && first.type === "paragraph" ? first.text : plainText(blocks));
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), 60)).trim() + "…";
}

// ---------------------------------------------------------------- inline-opmaak
// Lichte opmaak in tekstvelden: **vet**, *cursief* en [tekst](url). Geen HTML.

export type InlineNode =
  | { kind: "text"; text: string }
  | { kind: "strong"; children: InlineNode[] }
  | { kind: "em"; children: InlineNode[] }
  | { kind: "link"; href: string; children: InlineNode[] };

const INLINE_RE = /(\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\(([^)\s]+)\))/;

export function parseInline(text: string): InlineNode[] {
  const out: InlineNode[] = [];
  let rest = text;
  while (rest.length) {
    const m = INLINE_RE.exec(rest);
    if (!m || m.index === undefined) {
      out.push({ kind: "text", text: rest });
      break;
    }
    if (m.index > 0) out.push({ kind: "text", text: rest.slice(0, m.index) });
    if (m[2] !== undefined) out.push({ kind: "strong", children: parseInline(m[2]) });
    else if (m[3] !== undefined) out.push({ kind: "em", children: parseInline(m[3]) });
    else if (m[4] !== undefined) {
      const href = safeLink(m[5]);
      if (href) out.push({ kind: "link", href, children: parseInline(m[4]) });
      else out.push({ kind: "text", text: m[4] });
    }
    rest = rest.slice(m.index + m[0].length);
  }
  return out;
}

/** Alleen https-, interne en mailto-links; de rest wordt gewone tekst. */
export function safeLink(href: string): string | null {
  const h = href.trim();
  if (h.startsWith("/") && !h.startsWith("//")) return h;
  if (/^https:\/\/[^\s]+$/i.test(h) || /^mailto:[^\s]+$/i.test(h)) return h;
  return null;
}

export function stripInline(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1").replace(/\[([^\]]+)\]\([^)\s]+\)/g, "$1");
}

/** SEO-stip voor het overzicht, zelfde regels als bij de pagina's. */
export function postSeo(p: { title: string; seoTitle: string; seoDescription: string; excerpt: string }) {
  return { title: p.seoTitle || p.title, description: p.seoDescription || p.excerpt };
}
