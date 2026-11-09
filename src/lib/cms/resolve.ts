import type { BlockData, BlockDef, FieldDef, FieldValue, LinkValue, PageDef, PageDoc, Resolved, SeoValue } from "./types";

// Pure helpers: standaard + afwijkingen samenvoegen, het verschil terug
// berekenen, en tokens als {sites} invullen. Geen database hier, zodat het
// los te testen is.

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Houd een opgeslagen waarde alleen als hij de vorm van het veld heeft. */
export function conformField(field: FieldDef, value: unknown, fallback: FieldValue): FieldValue {
  switch (field.type) {
    case "text":
    case "textarea":
      return typeof value === "string" ? value.slice(0, 5000) : fallback;
    case "bool":
      return typeof value === "boolean" ? value : fallback;
    case "tags":
      return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string").slice(0, 50) : fallback;
    case "link": {
      if (!isObj(value)) return fallback;
      const fb = fallback as LinkValue;
      return {
        label: typeof value.label === "string" ? value.label : fb.label,
        href: typeof value.href === "string" ? value.href : fb.href,
      };
    }
    case "items": {
      if (!Array.isArray(value)) return fallback;
      const template = ((fallback as Record<string, unknown>[])[0] ?? {}) as Record<string, FieldValue>;
      return value.filter(isObj).slice(0, 50).map((item) => {
        const out: Record<string, FieldValue> = {};
        for (const f of field.itemFields ?? []) out[f.key] = conformField(f, item[f.key], template[f.key] ?? emptyOf(f));
        return out;
      });
    }
  }
}

/** Lege waarde voor een veldtype (voor een nieuw item zonder voorbeeld). */
export function emptyOf(field: FieldDef): FieldValue {
  switch (field.type) {
    case "text":
    case "textarea":
      return "";
    case "bool":
      return false;
    case "tags":
      return [];
    case "link":
      return { label: "", href: "" };
    case "items":
      return [];
  }
}

export function resolveBlock<D extends BlockData>(def: BlockDef<D>, overrides: unknown): D {
  const src = isObj(overrides) ? overrides : {};
  // Diep kopiëren: anders wijst een bewerkte lijst (items, tags) nog naar de standaard.
  const out = structuredClone(def.defaults) as Record<string, FieldValue>;
  for (const f of def.fields) {
    if (f.key in src) out[f.key] = conformField(f, src[f.key], def.defaults[f.key] ?? emptyOf(f));
  }
  return out as D;
}

export function resolvePage<B extends Record<string, BlockDef>>(def: PageDef<B>, doc: PageDoc | null | undefined): Resolved<B> {
  const ids = Object.keys(def.blocks) as (keyof B & string)[];
  const known = new Set<string>(ids);
  const stored = Array.isArray(doc?.order) ? doc!.order.filter((id): id is keyof B & string => known.has(id)) : [];
  // Blokken die later in code zijn toegevoegd komen achteraan mee.
  const order = Array.from(new Set([...stored, ...ids])) as (keyof B & string)[];
  const hidden = (Array.isArray(doc?.hidden) ? doc!.hidden : []).filter((id): id is keyof B & string => known.has(id));
  const blocks = {} as Resolved<B>["blocks"];
  for (const id of ids) (blocks as Record<string, BlockData>)[id] = resolveBlock(def.blocks[id], doc?.blocks?.[id]);
  const seoSrc = isObj(doc?.seo) ? (doc!.seo as Record<string, unknown>) : {};
  const seo: SeoValue = {
    title: typeof seoSrc.title === "string" ? seoSrc.title : def.seo.title,
    description: typeof seoSrc.description === "string" ? seoSrc.description : def.seo.description,
    keyword: typeof seoSrc.keyword === "string" ? seoSrc.keyword : def.seo.keyword,
  };
  return { order, hidden, blocks, seo };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Het omgekeerde van resolvePage: alleen bewaren wat afwijkt van de standaard. */
export function diffPage<B extends Record<string, BlockDef>>(def: PageDef<B>, full: Resolved<B>): PageDoc {
  const doc: PageDoc = {};
  const ids = Object.keys(def.blocks);
  if (!same(full.order, ids)) doc.order = [...full.order];
  if (full.hidden.length) doc.hidden = [...full.hidden];
  for (const id of ids) {
    const block = def.blocks[id];
    const data = (full.blocks as Record<string, BlockData>)[id];
    const changed: BlockData = {};
    for (const f of block.fields) if (!same(data[f.key], block.defaults[f.key])) changed[f.key] = data[f.key];
    if (Object.keys(changed).length) (doc.blocks ??= {})[id] = changed;
  }
  const seo: Partial<SeoValue> = {};
  for (const k of ["title", "description", "keyword"] as const) if (full.seo[k] !== def.seo[k]) seo[k] = full.seo[k];
  if (Object.keys(seo).length) doc.seo = seo;
  return doc;
}

export const isEmptyDoc = (doc: PageDoc | null | undefined) => !doc || Object.keys(doc).length === 0;

/** Vervang {tokens} in alle teksten, bv. "{sites}" → "500+". */
export function fillTokens<T>(value: T, tokens: Record<string, string>): T {
  const fill = (s: string) => s.replace(/\{(\w+)\}/g, (m, k: string) => (k in tokens ? tokens[k] : m));
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return fill(v);
    if (Array.isArray(v)) return v.map(walk);
    if (isObj(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(value) as T;
}

/** Alleen interne paden, https-links en mailto: als knoplink. */
export function safeHref(href: string): string {
  const h = href.trim();
  if (h.startsWith("/") && !h.startsWith("//")) return h;
  if (/^https:\/\//i.test(h) || /^mailto:/i.test(h)) return h;
  return "/";
}

/** SEO-stip in het overzicht: groen als titel én omschrijving een goede lengte hebben. */
export function seoScore(seo: SeoValue): "good" | "ok" | "bad" {
  const t = seo.title.trim().length;
  const d = seo.description.trim().length;
  const titleOk = t >= 30 && t <= 60;
  const descOk = d >= 110 && d <= 160;
  if (titleOk && descOk) return "good";
  if (t > 0 && d > 0) return "ok";
  return "bad";
}
