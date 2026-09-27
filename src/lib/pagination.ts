// Lists split into pages (Mijn orders, Facturen). ?pagina=N, 1 = first.

// The page asked for, kept within 1..pages.
export function currentPage(value: string | undefined, pages: number): number {
  return Math.min(Math.max(1, pages), Math.max(1, Number.parseInt(value ?? "1", 10) || 1));
}

// The page numbers to show under a list: all of them when there are few,
// otherwise the first, the last and the ones around the current page, with
// null for a gap ("…").
export function pageNumbers(current: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current - 1, current, current + 1].filter((p) => p >= 1 && p <= total));
  const sorted = Array.from(pages).sort((a, b) => a - b);
  const out: (number | null)[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push(null);
    out.push(p);
  });
  return out;
}
