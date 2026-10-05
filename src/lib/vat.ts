// Prices in the marketplace are excl. VAT; which VAT an order carries (21%,
// or none for a business abroad) is decided in src/lib/vatRules.ts.

export type VatTotals = { subtotal: number; vat: number; total: number };

type Amount = number | { toNumber(): number };

function toNumber(value: Amount): number {
  return typeof value === "number" ? value : value.toNumber();
}

// Worked out in whole cents, so a total never ends up a cent off from what
// Stripe charged (Stripe also only deals in cents).
export function vatTotals(prices: Amount[], rate: Amount): VatTotals {
  const subtotalCents = prices.reduce<number>((sum, p) => sum + Math.round(toNumber(p) * 100), 0);
  const vatCents = Math.round((subtotalCents * toNumber(rate)) / 100);
  return {
    subtotal: subtotalCents / 100,
    vat: vatCents / 100,
    total: (subtotalCents + vatCents) / 100,
  };
}

export function euro(amount: number): string {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(amount);
}
