// Het CMS van de publieke site (Admin → Publieke site).
//
// Werkwijze: de standaardteksten staan in code (src/lib/cms/pages.ts). De
// database bewaart per pagina alléén wat in het CMS is aangepast (een "doc"
// met afwijkingen). Zo blijft een wijziging via de code (bv. via Claude) direct
// zichtbaar, behalve op velden die in het CMS bewust zijn overschreven.

export type FieldType = "text" | "textarea" | "tags" | "link" | "bool" | "items";

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  help?: string;
  /** Alleen bij type "items": de velden van één item. */
  itemFields?: FieldDef[];
  /** Alleen bij type "items": hoe één item heet in de editor ("Vraag", "Kaart"). */
  itemLabel?: string;
};

export type LinkValue = { label: string; href: string };
export type FieldValue = string | string[] | boolean | LinkValue | Record<string, unknown>[];
export type BlockData = Record<string, FieldValue>;

export type BlockDef<D extends BlockData = BlockData> = {
  label: string;
  fields: FieldDef[];
  defaults: D;
};

export type SeoValue = { title: string; description: string; keyword: string };

export type PageDef<B extends Record<string, BlockDef> = Record<string, BlockDef>> = {
  slug: string;
  title: string;
  /** Pad op de publieke site, bv. "/prijzen". Leeg voor instellingen. */
  path: string;
  /** Mag deze pagina als concept offline? (De homepage niet.) */
  canUnpublish: boolean;
  /** Toont de editor een SEO-paneel en een live voorbeeld? */
  isPage: boolean;
  seo: SeoValue;
  blocks: B;
};

/** Wat er in de database staat: alleen afwijkingen van de standaard. */
export type PageDoc = {
  order?: string[];
  hidden?: string[];
  blocks?: Record<string, BlockData>;
  seo?: Partial<SeoValue>;
};

/** De volledige, samengevoegde inhoud van een pagina. */
export type Resolved<B extends Record<string, BlockDef>> = {
  order: (keyof B & string)[];
  hidden: (keyof B & string)[];
  blocks: { [K in keyof B]: B[K]["defaults"] };
  seo: SeoValue;
};

export type PageStatus = "published" | "draft";
