import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Invoice, Order, OrderItem, WebsiteProduct, Website, Company } from "@prisma/client";

type InvoiceWithOrder = Invoice & {
  customerCompany: Company;
  order: Order & {
    items: (OrderItem & { websiteProduct: WebsiteProduct & { website: Website } })[];
  };
};

export async function generateInvoicePdf(invoice: InvoiceWithOrder): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let y = 800;
  const left = 50;
  const ink = rgb(0.1, 0.1, 0.1);
  const soft = rgb(0.45, 0.45, 0.45);

  const draw = (text: string, opts: { size?: number; x?: number; f?: typeof font; color?: typeof ink } = {}) => {
    page.drawText(text, {
      x: opts.x ?? left,
      y,
      size: opts.size ?? 11,
      font: opts.f ?? font,
      color: opts.color ?? ink,
    });
  };

  draw("Nugevonden", { size: 20, f: bold });
  y -= 30;
  draw(`Factuur ${invoice.invoiceNumber}`, { size: 14, f: bold });
  y -= 20;
  draw(`Datum: ${invoice.issuedAt.toLocaleDateString("nl-NL")}`, { color: soft });
  y -= 40;

  draw("Factuuradres", { f: bold });
  y -= 16;
  draw(invoice.customerCompany.name, { color: soft });
  y -= 40;

  draw("Omschrijving", { f: bold });
  draw("Bedrag", { f: bold, x: 480 });
  y -= 8;
  page.drawLine({ start: { x: left, y }, end: { x: 545, y }, thickness: 0.5, color: soft });
  y -= 20;

  for (const item of invoice.order.items) {
    draw(`${item.websiteProduct.website.domain} — plaatsing`);
    draw(`€ ${item.customerPriceSnap.toFixed(2)}`, { x: 480 });
    y -= 20;
  }

  y -= 10;
  page.drawLine({ start: { x: left, y }, end: { x: 545, y }, thickness: 0.5, color: soft });
  y -= 20;
  draw("Totaal", { f: bold });
  draw(`€ ${invoice.amount.toFixed(2)}`, { f: bold, x: 480 });

  y = 60;
  draw("Betaald via Stripe. Bewaar deze factuur voor je administratie.", { size: 9, color: soft });

  return doc.save();
}
