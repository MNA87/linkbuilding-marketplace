import { Prisma, type SiteSettings } from "@prisma/client";
import { generateInvoicePdf, type InvoiceWithOrder } from "@/lib/invoicePdf";
import { customerDetailsFrom, sellerDetailsFrom } from "@/lib/invoices";
import { dueDate, type CollectiveGroup } from "@/lib/collectiveInvoices";
import type { VatNote } from "@/lib/vatRules";

// The verzamelfactuur as it would be made now, marked CONCEPT and without a
// number: for the admin to check before it's made and sent.
export function draftCollectivePdf(group: CollectiveGroup, settings: SiteSettings | null): Promise<Uint8Array> {
  const first = group.orders[0];
  const company = first.customer.company!;
  const contact = group.orders[group.orders.length - 1].customer;
  const now = new Date();
  const draft = {
    id: "concept",
    invoiceNumber: "CONCEPT",
    type: "INVOICE",
    subtotal: new Prisma.Decimal(group.subtotal),
    vatRate: new Prisma.Decimal(group.vatRate),
    vatAmount: new Prisma.Decimal(group.vat),
    amount: new Prisma.Decimal(group.total),
    pdfUrl: null,
    issuedAt: now,
    sellerDetails: sellerDetailsFrom(settings),
    customerDetails: customerDetailsFrom(company, contact, first.vatNote as VatNote | null),
    creditsInvoiceId: null,
    customerCompanyId: company.id,
    orderId: null,
    period: group.period,
    dueAt: dueDate(now),
    paidAt: null,
    reminderSentAt: null,
    customerCompany: company,
    creditsInvoice: null,
    order: null,
    collectiveOrders: group.orders,
  } as unknown as InvoiceWithOrder;
  return generateInvoicePdf(draft, settings);
}
