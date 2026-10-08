"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { collectiveInvoiceRecipient, issueCollectiveInvoice, periodLabel } from "@/lib/collectiveInvoices";
import { generateInvoicePdf, invoicePdfInclude } from "@/lib/invoicePdf";
import { sendCollectiveInvoiceEmail } from "@/lib/email";
import { euro } from "@/lib/vat";

type Result = { ok: boolean; message: string };

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  return session?.user.role === "admin";
}

const date = (d: Date) =>
  d.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Amsterdam" });

// Mails the invoice (or a reminder of it) with its PDF to the customer.
async function mailInvoice(invoiceId: string, kind: "collective_invoice" | "invoice_reminder"): Promise<Result> {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId }, include: invoicePdfInclude });
  if (!invoice?.period) return { ok: false, message: "Factuur niet gevonden." };
  const to = await collectiveInvoiceRecipient(invoice.id);
  if (!to) return { ok: false, message: "Geen e-mailadres van de klant gevonden." };
  const settings = await prisma.siteSettings.findUnique({ where: { id: 1 } });
  const pdf = await generateInvoicePdf(invoice, settings);
  const sent = await sendCollectiveInvoiceEmail(
    kind,
    to,
    {
      invoiceNumber: invoice.invoiceNumber,
      period: periodLabel(invoice.period),
      amount: euro(invoice.amount.toNumber()).replace("€", "").trim(),
      dueDate: invoice.dueAt ? date(invoice.dueAt) : "",
      iban: settings?.sellerIban ?? "",
    },
    pdf
  );
  return sent
    ? { ok: true, message: `Verstuurd aan ${to}.` }
    : { ok: false, message: `Versturen aan ${to} is mislukt. Probeer het later nog eens.` };
}

// "Factuur maken en versturen": the number is fixed from here on.
export async function createCollectiveInvoiceAction(key: string): Promise<Result> {
  if (!(await requireAdmin())) return { ok: false, message: "Niet toegestaan." };
  const made = await issueCollectiveInvoice(String(key));
  if ("error" in made) return { ok: false, message: made.error };
  const result = await mailInvoice(made.invoiceId, "collective_invoice");
  revalidatePath("/admin", "layout");
  return result.ok
    ? { ok: true, message: `Factuur gemaakt. ${result.message}` }
    : {
        ok: false,
        message: `Factuur gemaakt, maar niet gemaild: ${result.message} Gebruik "Herinnering sturen" om hem alsnog te sturen.`,
      };
}

export async function sendInvoiceReminderAction(invoiceId: string): Promise<Result> {
  if (!(await requireAdmin())) return { ok: false, message: "Niet toegestaan." };
  const result = await mailInvoice(String(invoiceId), "invoice_reminder");
  if (result.ok)
    await prisma.invoice.update({ where: { id: String(invoiceId) }, data: { reminderSentAt: new Date() } });
  revalidatePath("/admin", "layout");
  return result;
}

// The money came in (or not after all): marked by hand.
export async function setInvoicePaidAction(invoiceId: string, paid: boolean): Promise<Result> {
  if (!(await requireAdmin())) return { ok: false, message: "Niet toegestaan." };
  await prisma.invoice.updateMany({
    where: { id: String(invoiceId), period: { not: null } },
    data: { paidAt: paid ? new Date() : null },
  });
  revalidatePath("/admin", "layout");
  return { ok: true, message: paid ? "Op betaald gezet." : "Weer op openstaand gezet." };
}
