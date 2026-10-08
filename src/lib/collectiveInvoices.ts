import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { vatTotals } from "@/lib/vat";
import type { VatNote } from "@/lib/vatRules";
import { itemPrice } from "@/lib/writingService";
import { allocateInvoiceNumber, customerDetailsFrom, sellerDetailsFrom } from "@/lib/invoices";

// Verzamelfactuur: orders on account (ordered by mail, Admin →
// Binnengekomen) aren't paid one by one but go, per customer per month, on
// one invoice. The admin checks the draft and sends it; it's due in 30 days.
export const PAYMENT_DAYS = 30;

// Statuses that aren't billed (cancelled before or instead of placing).
const NOT_BILLED = ["CANCELLED", "REJECTED", "REFUND_REQUESTED"] as const;

// "2026-10" for a date, in Dutch time.
export function periodOf(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit" })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  return `${parts.year}-${parts.month}`;
}

// "oktober 2026".
export function periodLabel(period: string): string {
  const [year, month] = period.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 15)).toLocaleDateString("nl-NL", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

// Whether the month is over (Dutch time), so the bill is complete.
export const periodOver = (period: string, now = new Date()) => periodOf(now) > period;

export const dueDate = (issuedAt: Date) => new Date(issuedAt.getTime() + PAYMENT_DAYS * 86_400_000);

const orderInclude = {
  customer: { include: { company: true } },
  items: { include: { websiteProduct: { include: { website: true, product: true } } } },
} satisfies Prisma.OrderInclude;

export type CollectiveOrder = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

export type CollectiveGroup = {
  key: string;
  companyId: string;
  companyName: string;
  period: string;
  vatRate: number;
  orders: CollectiveOrder[];
  links: number;
  subtotal: number;
  vat: number;
  total: number;
};

export const groupKey = (companyId: string, period: string, vatRate: number) => `${companyId}|${period}|${vatRate}`;

export function parseGroupKey(key: string): { companyId: string; period: string; vatRate: number } | null {
  const [companyId, period, rate] = String(key).split("|");
  if (!companyId || !/^\d{4}-\d{2}$/.test(period ?? "") || rate === undefined || Number.isNaN(Number(rate)))
    return null;
  return { companyId, period, vatRate: Number(rate) };
}

// The orders on account still to bill, per customer, month and VAT rate
// (one invoice has one rate), oldest month first.
export async function pendingCollectiveGroups(): Promise<CollectiveGroup[]> {
  const orders = await prisma.order.findMany({
    where: { onAccount: true, collectiveInvoiceId: null, status: { notIn: [...NOT_BILLED] } },
    include: orderInclude,
    orderBy: { createdAt: "asc" },
  });
  const groups = new Map<string, CollectiveGroup>();
  for (const order of orders) {
    const company = order.customer.company;
    if (!company) continue;
    const period = periodOf(order.createdAt);
    const rate = order.vatRate.toNumber();
    const key = groupKey(company.id, period, rate);
    const group =
      groups.get(key) ??
      ({
        key,
        companyId: company.id,
        companyName: company.name,
        period,
        vatRate: rate,
        orders: [],
        links: 0,
        subtotal: 0,
        vat: 0,
        total: 0,
      } satisfies CollectiveGroup);
    group.orders.push(order);
    groups.set(key, group);
  }
  for (const group of Array.from(groups.values())) {
    const prices = group.orders.flatMap((o) => o.items.map(itemPrice));
    const totals = vatTotals(prices, group.vatRate);
    Object.assign(group, { links: prices.length, ...totals });
  }
  return Array.from(groups.values()).sort(
    (a, b) => a.period.localeCompare(b.period) || a.companyName.localeCompare(b.companyName)
  );
}

export async function pendingCollectiveGroup(key: string): Promise<CollectiveGroup | null> {
  return (await pendingCollectiveGroups()).find((g) => g.key === key) ?? null;
}

// Makes the verzamelfactuur for one group: a number from the one unbroken
// sequence, the seller and customer as they are now, due in 30 days. The
// orders are tied to it in the same transaction, so none is billed twice.
export async function issueCollectiveInvoice(key: string): Promise<{ invoiceId: string } | { error: string }> {
  const group = await pendingCollectiveGroup(key);
  if (!group) return { error: "Er is niets meer te factureren voor deze klant en maand." };
  const company = group.orders[0].customer.company!;
  const contact = group.orders[group.orders.length - 1].customer;
  const settings = await prisma.siteSettings.findUnique({ where: { id: 1 } });
  const issuedAt = new Date();
  const orderIds = group.orders.map((o) => o.id);

  let invoice;
  try {
    invoice = await prisma.$transaction(async (tx) => {
      const invoiceNumber = await allocateInvoiceNumber(tx, issuedAt);
      const created = await tx.invoice.create({
        data: {
          invoiceNumber,
          type: "INVOICE",
          subtotal: group.subtotal,
          vatRate: group.vatRate,
          vatAmount: group.vat,
          amount: group.total,
          issuedAt,
          dueAt: dueDate(issuedAt),
          period: group.period,
          sellerDetails: sellerDetailsFrom(settings),
          customerDetails: customerDetailsFrom(company, contact, group.orders[0].vatNote as VatNote | null),
          customerCompanyId: company.id,
        },
      });
      const tied = await tx.order.updateMany({
        where: { id: { in: orderIds }, collectiveInvoiceId: null },
        data: { collectiveInvoiceId: created.id },
      });
      // Someone billed (part of) these orders at the same moment: undo.
      if (tied.count !== orderIds.length) throw new Error("ALREADY_BILLED");
      return created;
    });
  } catch (err) {
    if ((err as Error).message === "ALREADY_BILLED") return { error: "Deze orders zijn intussen al gefactureerd." };
    throw err;
  }
  return { invoiceId: invoice.id };
}

// Where the invoice is mailed: the account that ordered last.
export async function collectiveInvoiceRecipient(invoiceId: string): Promise<string | null> {
  const order = await prisma.order.findFirst({
    where: { collectiveInvoiceId: invoiceId },
    orderBy: { createdAt: "desc" },
    select: { customer: { select: { email: true } } },
  });
  return order?.customer.email ?? null;
}
