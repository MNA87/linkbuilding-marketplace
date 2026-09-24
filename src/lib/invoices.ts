import { Prisma, type Company, type SiteSettings, type User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { vatTotals } from "@/lib/vat";

export type SellerDetails = {
  name: string;
  address: string;
  postcode: string;
  city: string;
  kvk: string;
  vatNumber: string;
  iban: string;
  email: string;
};

export type CustomerDetails = {
  companyName: string;
  contactName: string;
  email: string;
  address: string;
  postcode: string;
  city: string;
  vatNumber: string | null;
};

export function formatInvoiceNumber(year: number, sequence: number): string {
  return `${year}-${String(sequence).padStart(4, "0")}`;
}

// Dutch invoices must be numbered in one unbroken sequence. The counter row is
// bumped inside the same transaction that creates the invoice, so if that
// create fails the number is rolled back too and no gap is left behind.
async function allocateInvoiceNumber(tx: Prisma.TransactionClient, date: Date): Promise<string> {
  const year = date.getFullYear();
  const counter = await tx.invoiceCounter.upsert({
    where: { year },
    create: { year, last: 1 },
    update: { last: { increment: 1 } },
  });
  return formatInvoiceNumber(year, counter.last);
}

export function sellerDetailsFrom(settings: SiteSettings | null): SellerDetails {
  return {
    name: settings?.sellerName ?? "",
    address: settings?.sellerAddress ?? "",
    postcode: settings?.sellerPostcode ?? "",
    city: settings?.sellerCity ?? "",
    kvk: settings?.sellerKvk ?? "",
    vatNumber: settings?.sellerVatNumber ?? "",
    iban: settings?.sellerIban ?? "",
    email: settings?.sellerEmail ?? "",
  };
}

export function customerDetailsFrom(company: Company, user: Pick<User, "name" | "email">): CustomerDetails {
  return {
    companyName: company.name,
    contactName: user.name,
    email: user.email,
    address: company.billingAddress,
    postcode: company.billingPostcode,
    city: company.billingCity,
    vatNumber: company.vatNumber,
  };
}

export function billingDetailsComplete(company: Pick<Company, "billingAddress" | "billingPostcode" | "billingCity">) {
  return Boolean(company.billingAddress.trim() && company.billingPostcode.trim() && company.billingCity.trim());
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

// Called once an order is paid. Safe to call more than once (a retried
// webhook, reconciliation): an order only ever gets one invoice.
export async function issueInvoiceForOrder(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { customer: { include: { company: true } }, items: true, invoices: true },
  });
  if (!order?.customer.company) return;
  if (order.invoices.some((i) => i.type === "INVOICE")) return;

  const company = order.customer.company;
  const totals = vatTotals(
    order.items.map((i) => i.customerPriceSnap),
    order.vatRate
  );
  const settings = await prisma.siteSettings.findUnique({ where: { id: 1 } });
  const issuedAt = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      const invoiceNumber = await allocateInvoiceNumber(tx, issuedAt);
      await tx.invoice.create({
        data: {
          invoiceNumber,
          type: "INVOICE",
          subtotal: totals.subtotal,
          vatRate: order.vatRate,
          vatAmount: totals.vat,
          amount: totals.total,
          issuedAt,
          sellerDetails: sellerDetailsFrom(settings),
          customerDetails: customerDetailsFrom(company, order.customer),
          customerCompanyId: company.id,
          orderId: order.id,
        },
      });
    });
  } catch (err) {
    // A parallel call already issued it — fine, that's the one invoice.
    if (!isUniqueViolation(err)) throw err;
  }
}

// Called when a paid order is refunded: an issued invoice may never be
// changed or deleted, so it's cancelled with a credit invoice for the same
// amounts, negated.
export async function issueCreditInvoiceForOrder(orderId: string): Promise<void> {
  const invoices = await prisma.invoice.findMany({ where: { orderId } });
  const original = invoices.find((i) => i.type === "INVOICE");
  if (!original || invoices.some((i) => i.type === "CREDIT")) return;

  const settings = await prisma.siteSettings.findUnique({ where: { id: 1 } });
  const issuedAt = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      const invoiceNumber = await allocateInvoiceNumber(tx, issuedAt);
      await tx.invoice.create({
        data: {
          invoiceNumber,
          type: "CREDIT",
          subtotal: original.subtotal.negated(),
          vatRate: original.vatRate,
          vatAmount: original.vatAmount.negated(),
          amount: original.amount.negated(),
          issuedAt,
          // The seller as on the original, unless it predates the snapshots.
          sellerDetails: original.sellerDetails ?? sellerDetailsFrom(settings),
          customerDetails: original.customerDetails ?? Prisma.JsonNull,
          creditsInvoiceId: original.id,
          customerCompanyId: original.customerCompanyId,
          orderId,
        },
      });
    });
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
  }
}
