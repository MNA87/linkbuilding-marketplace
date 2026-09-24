// A year or one quarter of it, for the admin invoice overview (the VAT
// return is filed per quarter).
export type InvoicePeriod = { year: number; quarter: number | null; from: Date; to: Date; label: string };

export function invoicePeriod(yearParam?: string, quarterParam?: string, now = new Date()): InvoicePeriod {
  const year = Number(yearParam) >= 2000 && Number(yearParam) <= 2100 ? Number(yearParam) : now.getFullYear();
  const q = Number(quarterParam);
  const quarter = Number.isInteger(q) && q >= 1 && q <= 4 ? q : null;
  const from = new Date(year, quarter ? (quarter - 1) * 3 : 0, 1);
  const to = new Date(year, quarter ? quarter * 3 : 12, 1);
  return { year, quarter, from, to, label: quarter ? `Q${quarter} ${year}` : `${year}` };
}
