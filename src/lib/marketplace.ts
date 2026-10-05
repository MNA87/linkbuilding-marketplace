// Sorting, filters and labels for the Blog links / Homepage links tables.

// Figures a list can be sorted by: high–low ("dr") or, from clicking the
// column header again, low–high ("dr-laag").
type Metric = "dr" | "da" | "tf" | "cf" | "verkeer";

export const SORTS = [
  { value: "dr", label: "DR hoog–laag", menu: true },
  { value: "populair", label: "Populair", menu: true },
  { value: "nieuw", label: "Nieuwste", menu: true },
  { value: "prijs-laag", label: "Prijs laag–hoog", menu: true },
  { value: "prijs-hoog", label: "Prijs hoog–laag", menu: true },
  { value: "da", label: "DA hoog–laag", menu: true },
  { value: "tf", label: "TF hoog–laag", menu: true },
  { value: "cf", label: "CF hoog–laag", menu: true },
  { value: "verkeer", label: "Verkeer hoog–laag", menu: true },
  { value: "dr-laag", label: "DR laag–hoog", menu: false },
  { value: "da-laag", label: "DA laag–hoog", menu: false },
  { value: "tf-laag", label: "TF laag–hoog", menu: false },
  { value: "cf-laag", label: "CF laag–hoog", menu: false },
  { value: "verkeer-laag", label: "Verkeer laag–hoog", menu: false },
] as const;
export type SortKey = (typeof SORTS)[number]["value"];
export const DEFAULT_SORT: SortKey = "dr";

export function parseSort(value: string | undefined): SortKey {
  return SORTS.some((s) => s.value === value) ? (value as SortKey) : DEFAULT_SORT;
}

// A column header's link: high–low first, low–high on a second click.
export function headerSort(metric: Metric, current: SortKey): SortKey {
  return current === metric ? (`${metric}-laag` as SortKey) : metric;
}

// "Populair" only means something once a site has actually been ordered a
// few times — with a handful of orders in total it would just be noise.
export const POPULAR_MIN_ORDERS = 3;
export const POPULAR_MAX = 3;
// "Nieuw" for sites added in the last month.
export const NEW_DAYS = 30;

export type SortableRow = {
  orders: number;
  createdAt: Date;
  price: number;
  domainRating: number | null;
  domainAuthority: number | null;
  trustFlow: number | null;
  citationFlow: number | null;
  traffic: number | null;
  domain: string;
};

export function popularIds<T extends SortableRow & { id: string }>(rows: T[]): Set<string> {
  return new Set(
    rows
      .filter((r) => r.orders >= POPULAR_MIN_ORDERS)
      .sort((a, b) => b.orders - a.orders)
      .slice(0, POPULAR_MAX)
      .map((r) => r.id)
  );
}

export function isNew(createdAt: Date, now = new Date()): boolean {
  return now.getTime() - createdAt.getTime() < NEW_DAYS * 24 * 60 * 60 * 1000;
}

// Missing numbers always go last, whichever way is sorted.
function byNumber(a: number | null, b: number | null, dir: 1 | -1): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return (a - b) * dir;
}

export function sortRows<T extends SortableRow>(rows: T[], sort: SortKey): T[] {
  const newest = (a: T, b: T) => b.createdAt.getTime() - a.createdAt.getTime();
  const figure: Record<Metric, (r: T) => number | null> = {
    dr: (r) => r.domainRating,
    da: (r) => r.domainAuthority,
    tf: (r) => r.trustFlow,
    cf: (r) => r.citationFlow,
    verkeer: (r) => r.traffic,
  };
  const compare = (a: T, b: T): number => {
    if (sort === "populair") return b.orders - a.orders || newest(a, b);
    if (sort === "nieuw") return newest(a, b);
    if (sort === "prijs-laag") return a.price - b.price;
    if (sort === "prijs-hoog") return b.price - a.price;
    const [metric, low] = sort.split("-") as [Metric, string | undefined];
    return byNumber(figure[metric](a), figure[metric](b), low ? 1 : -1);
  };
  return [...rows].sort((a, b) => compare(a, b) || a.domain.localeCompare(b.domain));
}

// ---------------------------------------------------------------------------
// The filter row under the column headers. Every filter lives in the URL, so
// a filtered list can be shared, bookmarked or opened again with Back.

export const PER_PAGE_OPTIONS = [20, 50, 100] as const;
export const DEFAULT_PER_PAGE = 50;

export type TableFilters = {
  q: string; // search box: domain or niche
  domain: string; // the "Domein" column
  niche: string; // category id
  country: string;
  language: string;
  minDr: number | null;
  minDa: number | null;
  minTraffic: number | null;
  minLinks: number | null;
  sponsored: "" | "ja" | "nee";
  duur: "" | "permanent" | "jaar";
  maxPrice: number | null;
};

// The URL keys of the filters, to clear them all at once ("Wis filters").
export const FILTER_KEYS = [
  "q",
  "domain",
  "niche",
  "country",
  "language",
  "minDr",
  "minDa",
  "minTraffic",
  "minLinks",
  "sponsored",
  "duur",
  "maxPrice",
] as const;

const numberParam = (v: string | undefined) => {
  if (!v) return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export function parseFilters(p: Partial<Record<(typeof FILTER_KEYS)[number], string>>): TableFilters {
  return {
    q: (p.q ?? "").trim(),
    domain: (p.domain ?? "").trim(),
    niche: p.niche ?? "",
    country: p.country ?? "",
    language: p.language ?? "",
    minDr: numberParam(p.minDr),
    minDa: numberParam(p.minDa),
    minTraffic: numberParam(p.minTraffic),
    minLinks: numberParam(p.minLinks),
    sponsored: p.sponsored === "ja" || p.sponsored === "nee" ? p.sponsored : "",
    duur: p.duur === "permanent" || p.duur === "jaar" ? p.duur : "",
    maxPrice: numberParam(p.maxPrice),
  };
}

export type FilterableRow = {
  domain: string;
  niches: { id: string; name: string }[];
  countryId: string;
  languageId: string;
  domainRating: number | null;
  domainAuthority: number | null;
  traffic: number | null;
  maxLinks: number | null;
  sponsored: boolean;
  periodic: boolean;
  price: number;
};

// A "≥" filter leaves out sites without that figure.
const atLeast = (value: number | null, min: number | null) => min === null || (value ?? -1) >= min;

export function filterRows<T extends FilterableRow>(rows: T[], f: TableFilters): T[] {
  const q = f.q.toLowerCase();
  const domain = f.domain.toLowerCase();
  return rows.filter(
    (r) =>
      (!q || r.domain.toLowerCase().includes(q) || r.niches.some((n) => n.name.toLowerCase().includes(q))) &&
      (!domain || r.domain.toLowerCase().includes(domain)) &&
      (!f.niche || r.niches.some((n) => n.id === f.niche)) &&
      (!f.country || r.countryId === f.country) &&
      (!f.language || r.languageId === f.language) &&
      atLeast(r.domainRating, f.minDr) &&
      atLeast(r.domainAuthority, f.minDa) &&
      atLeast(r.traffic, f.minTraffic) &&
      atLeast(r.maxLinks, f.minLinks) &&
      (!f.sponsored || r.sponsored === (f.sponsored === "ja")) &&
      (!f.duur || r.periodic === (f.duur === "jaar")) &&
      (f.maxPrice === null || r.price <= f.maxPrice)
  );
}

// Page numbers around the current one, e.g. 1 … 4 5 6 … 12 (0 = "…").
export function pageNumbers(page: number, total: number): number[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const around = [page - 1, page, page + 1].filter((p) => p > 1 && p < total);
  const pages = [1, ...around, total];
  const out: number[] = [];
  for (const p of pages) {
    if (out.length && p - out[out.length - 1] > 1) out.push(0);
    out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------------------
// "Kolommen": which columns a customer shows. Domein and Prijs are always
// there; the rest can be switched on and off, remembered in a cookie so the
// page comes from the server already right.

export const OPTIONAL_COLUMNS = [
  "niche",
  "land",
  "taal",
  "duur",
  "dr",
  "da",
  "verkeer",
  "tfcf",
  "rd",
  "maxlinks",
  "gesponsord",
  "voorbeeld",
] as const;
export type ColumnKey = (typeof OPTIONAL_COLUMNS)[number];

// A new customer's table: calm, the figures most people look at.
export const DEFAULT_COLUMNS: ColumnKey[] = ["niche", "dr", "verkeer", "duur"];

export const COLUMNS_COOKIE = "kolommen";
const NONE = "geen";

// The filters under a column; switching the column off clears them, so no
// invisible filter keeps working.
export const COLUMN_FILTERS: Partial<Record<ColumnKey, (typeof FILTER_KEYS)[number][]>> = {
  niche: ["niche"],
  land: ["country"],
  taal: ["language"],
  duur: ["duur"],
  dr: ["minDr"],
  da: ["minDa"],
  verkeer: ["minTraffic"],
  maxlinks: ["minLinks"],
  gesponsord: ["sponsored"],
};

export function parseColumns(value: string | undefined): ColumnKey[] {
  if (value === undefined || value === "") return DEFAULT_COLUMNS;
  if (value === NONE) return [];
  const picked = value.split(".");
  // Always in the table's own order, whatever the cookie says.
  const columns = OPTIONAL_COLUMNS.filter((c) => picked.includes(c));
  return columns.length > 0 ? columns : DEFAULT_COLUMNS;
}

export function serializeColumns(columns: readonly ColumnKey[]): string {
  return columns.length === 0 ? NONE : OPTIONAL_COLUMNS.filter((c) => columns.includes(c)).join(".");
}
