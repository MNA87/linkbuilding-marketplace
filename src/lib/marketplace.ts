// Sorting and labels for the Blog links / Homepage links lists.

// The desktop columns of a site row, shared with the column headers so they
// line up (kept out of the client component: the page is a server component):
// website, DR, DA, TF, CF, price, Voeg toe, chevron.
export const DESKTOP_COLUMNS =
  "md:grid-cols-[minmax(0,1fr)_56px_56px_56px_56px_100px_110px_24px]";

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
