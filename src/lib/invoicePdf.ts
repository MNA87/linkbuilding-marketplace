import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import type { Invoice, Order, OrderItem, WebsiteProduct, Website, Company, Product, SiteSettings } from "@prisma/client";
import { euro } from "@/lib/vat";
import { sellerDetailsFrom, type CustomerDetails, type SellerDetails } from "@/lib/invoices";

type InvoiceWithOrder = Invoice & {
  customerCompany: Company;
  creditsInvoice: Invoice | null;
  order: Order & {
    items: (OrderItem & { websiteProduct: WebsiteProduct & { website: Website; product: Product } })[];
  };
};

const PAGE_RIGHT = 545;
const LEFT = 50;

// The standard PDF fonts only know WinAnsi characters; Intl's number
// formatting uses (narrow) no-break spaces, which it can't encode.
function plain(text: string): string {
  return text.replace(/[  ]/g, " ");
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > width && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function itemDescription(item: InvoiceWithOrder["order"]["items"][number]): string {
  const base = `${item.websiteProduct.product.name} op ${item.websiteProduct.website.domain}`;
  if (item.articleTitle) return `${base}: "${item.articleTitle}"`;
  if (item.anchorText) return `${base}: link "${item.anchorText}"`;
  return base;
}

// Everything a Dutch invoice has to state (art. 35a Wet OB): number, date,
// seller and customer name + address, the seller's VAT and KvK numbers, what
// was delivered, the amount excl. VAT, the VAT rate and amount, and — for a
// credit invoice — which invoice it cancels.
export async function generateInvoicePdf(
  invoice: InvoiceWithOrder,
  currentSettings: SiteSettings | null
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.1, 0.1, 0.1);
  const soft = rgb(0.45, 0.45, 0.45);

  const isCredit = invoice.type === "CREDIT";
  const hasVat = !invoice.vatRate.isZero();
  const sign = isCredit ? -1 : 1;
  // Invoices from before the snapshots existed fall back to what's known now.
  const seller = (invoice.sellerDetails as SellerDetails | null) ?? sellerDetailsFrom(currentSettings);
  const customer = (invoice.customerDetails as CustomerDetails | null) ?? {
    companyName: invoice.customerCompany.name,
    contactName: "",
    email: "",
    address: invoice.customerCompany.billingAddress,
    postcode: invoice.customerCompany.billingPostcode,
    city: invoice.customerCompany.billingCity,
    vatNumber: invoice.customerCompany.vatNumber,
  };

  let y = 790;
  const text = (value: string, x: number, opts: { size?: number; f?: PDFFont; color?: typeof ink } = {}) =>
    page.drawText(plain(value), { x, y, size: opts.size ?? 10, font: opts.f ?? font, color: opts.color ?? ink });
  const right = (value: string, opts: { size?: number; f?: PDFFont; color?: typeof ink } = {}) => {
    const f = opts.f ?? font;
    const size = opts.size ?? 10;
    text(value, PAGE_RIGHT - f.widthOfTextAtSize(plain(value), size), opts);
  };
  const lines = (values: string[], x: number, opts: { size?: number; color?: typeof ink } = {}) => {
    for (const v of values.filter(Boolean)) {
      text(v, x, opts);
      y -= 14;
    }
  };

  // Seller, top left; document type, top right.
  text(seller.name || "Nugevonden", LEFT, { size: 16, f: bold });
  right(isCredit ? "CREDITFACTUUR" : "FACTUUR", { size: 16, f: bold });
  y -= 20;
  const sellerTop = y;
  lines([seller.address, [seller.postcode, seller.city].filter(Boolean).join(" "), seller.email], LEFT, { color: soft });

  // Invoice details, right column.
  y = sellerTop;
  const paidAt = invoice.order.paidAt ?? invoice.issuedAt;
  const meta: [string, string][] = [
    [isCredit ? "Creditfactuurnummer" : "Factuurnummer", invoice.invoiceNumber],
    ["Factuurdatum", invoice.issuedAt.toLocaleDateString("nl-NL")],
    [isCredit ? "Oorspronkelijke betaling" : "Betaaldatum", paidAt.toLocaleDateString("nl-NL")],
    ["Ordernummer", `#${invoice.order.orderNumber}`],
  ];
  if (isCredit && invoice.creditsInvoice) meta.push(["Crediteert factuur", invoice.creditsInvoice.invoiceNumber]);
  for (const [label, value] of meta) {
    text(label, 330, { color: soft });
    right(value);
    y -= 14;
  }

  // Customer.
  y = Math.min(y, sellerTop - 3 * 14) - 30;
  text("Factuur aan", LEFT, { f: bold });
  y -= 16;
  lines(
    [
      customer.companyName,
      customer.contactName && customer.contactName !== customer.companyName ? `t.a.v. ${customer.contactName}` : "",
      customer.address,
      [customer.postcode, customer.city].filter(Boolean).join(" "),
      customer.vatNumber ? `BTW-nummer: ${customer.vatNumber}` : "",
    ],
    LEFT
  );

  // Lines.
  y -= 24;
  text("Omschrijving", LEFT, { f: bold });
  right(hasVat ? "Bedrag excl. BTW" : "Bedrag", { f: bold });
  y -= 8;
  page.drawLine({ start: { x: LEFT, y }, end: { x: PAGE_RIGHT, y }, thickness: 0.5, color: soft });
  y -= 18;
  for (const item of invoice.order.items) {
    const descLines = wrap(plain(itemDescription(item)), font, 10, 360);
    right(euro(sign * item.customerPriceSnap.toNumber()));
    for (const line of descLines) {
      text(line, LEFT);
      y -= 14;
    }
    y -= 6;
  }
  page.drawLine({ start: { x: LEFT, y: y + 6 }, end: { x: PAGE_RIGHT, y: y + 6 }, thickness: 0.5, color: soft });

  // Totals.
  y -= 12;
  const totalRow = (label: string, value: number, f: PDFFont = font) => {
    text(label, 330, { f });
    right(euro(value), { f });
    y -= 16;
  };
  if (hasVat) {
    totalRow("Subtotaal excl. BTW", invoice.subtotal.toNumber());
    totalRow(`BTW ${invoice.vatRate.toNumber()}%`, invoice.vatAmount.toNumber());
  }
  y -= 4;
  totalRow(hasVat ? "Totaal incl. BTW" : "Totaal", invoice.amount.toNumber(), bold);

  // Footer: payment note and the seller's registration numbers.
  y = 90;
  text(
    isCredit
      ? "Het bedrag van deze creditfactuur is teruggestort via Stripe."
      : `Betaald via Stripe op ${paidAt.toLocaleDateString("nl-NL")}. Bewaar deze factuur voor je administratie.`,
    LEFT,
    { size: 9, color: soft }
  );
  y -= 14;
  const registration = [
    seller.kvk && `KvK ${seller.kvk}`,
    seller.vatNumber && `BTW ${seller.vatNumber}`,
    seller.iban && `IBAN ${seller.iban}`,
  ].filter(Boolean);
  if (registration.length) text(registration.join("  ·  "), LEFT, { size: 9, color: soft });

  return doc.save();
}
