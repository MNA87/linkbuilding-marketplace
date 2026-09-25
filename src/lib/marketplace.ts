// Sorting and labels for the Blog links / Homepage links lists.

// The desktop columns of a site row, shared with the column headers so they
// line up (kept out of the client component: the page is a server component).
export const DESKTOP_COLUMNS = "md:grid-cols-[minmax(0,1fr)_80px_110px_110px_130px_24px]";

export const SORTS = [
  { value: "populair", label: "Populair" },
  { value: "nieuw", label: "Nieuwste" },
  { value: "prijs-laag", label: "Prijs laag–hoog" },
  { value: "prijs-hoog", label: "Prijs hoog–laag" },
  { value: "dr", label: "DR hoog–laag" },
  { value: "verkeer", label: "Verkeer hoog–laag" },
] as const;
export type SortKey = (typeof SORTS)[number]["value"];
export const DEFAULT_SORT: SortKey = "populair";

export function parseSort(value: string | undefined): SortKey {
  return SORTS.some((s) => s.value === value) ? (value as SortKey) : DEFAULT_SORT;
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
  const compare: Record<SortKey, (a: T, b: T) => number> = {
    populair: (a, b) => b.orders - a.orders || newest(a, b),
    nieuw: newest,
    "prijs-laag": (a, b) => a.price - b.price,
    "prijs-hoog": (a, b) => b.price - a.price,
    dr: (a, b) => byNumber(a.domainRating, b.domainRating, -1),
    verkeer: (a, b) => byNumber(a.traffic, b.traffic, -1),
  };
  return [...rows].sort((a, b) => compare[sort](a, b) || a.domain.localeCompare(b.domain));
}
