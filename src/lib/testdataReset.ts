import { prisma } from "@/lib/prisma";
import { backupNow, storageConfigured } from "@/lib/databaseBackup";

// "Testdata wissen" (Instellingen → Systeem): back to zero before going
// live, as often as needed while testing. Gone: every customer with their
// orders, payments, invoices (the numbering starts again at 1), placements,
// messages and the mails in Binnengekomen. Kept: the websites, prices,
// topics, lists, settings, planning and the admin accounts. A copy of the
// database is made first, so there's always a way back.
//
// Only while Stripe takes test payments: with a live key no button and no
// wiping, so it can never hit real customers.

export const RESET_LABEL = "voorwissen";

export function stripeLive(): boolean {
  const key = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  return key.startsWith("sk_live_") || key.startsWith("rk_live_");
}

export type ResetCounts = {
  customers: number;
  orders: number;
  invoices: number;
  payments: number;
  placements: number;
  mails: number;
};

export async function resetPreview(): Promise<ResetCounts> {
  const [customers, orders, invoices, payments, placements, inbound, outbound] = await Promise.all([
    prisma.user.count({ where: { role: { name: "customer" } } }),
    prisma.order.count(),
    prisma.invoice.count(),
    prisma.payment.count(),
    prisma.placement.count(),
    prisma.inboundMail.count(),
    prisma.outboundMail.count(),
  ]);
  return { customers, orders, invoices, payments, placements, mails: inbound + outbound };
}

export async function resetTestdata(): Promise<{ counts: ResetCounts; backupKey: string }> {
  if (stripeLive()) throw new Error("Stripe staat live: testdata wissen kan niet meer.");
  if (!storageConfigured()) throw new Error("Er kan geen back-up gemaakt worden; er is niets gewist.");
  const counts = await resetPreview();
  let backupKey: string;
  try {
    backupKey = (await backupNow(new Date(), RESET_LABEL)).key;
  } catch {
    throw new Error("Eerst een back-up maken lukte niet; er is niets gewist.");
  }

  await wipe();
  console.log(`testdata gewist (back-up vooraf: ${backupKey})`, counts);
  return { counts, backupKey };
}

// The wiping itself, in one transaction: all of it or nothing.
export async function wipe(): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      await tx.inboundMail.deleteMany({});
      await tx.payment.deleteMany({});
      await tx.order.updateMany({ data: { collectiveInvoiceId: null } });
      await tx.invoice.deleteMany({});
      // With the orders go their links, placements, messages and sent mails.
      await tx.order.deleteMany({});
      await tx.publisherPayout.deleteMany({});
      await tx.user.deleteMany({ where: { role: { name: "customer" } } });
      // Customer companies left without anyone (not a site owner's).
      const companies = await tx.company.findMany({
        where: { type: "CUSTOMER", users: { none: {} }, websites: { none: {} } },
        select: { id: true },
      });
      const ids = companies.map((c) => c.id);
      await tx.project.deleteMany({ where: { customerCompanyId: { in: ids } } });
      await tx.company.deleteMany({ where: { id: { in: ids } } });
      // Invoice and order numbers start again at 1.
      await tx.invoiceCounter.deleteMany({});
      await tx.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"Order"', 'orderNumber'), 1, false)`);
    },
    { timeout: 120_000 }
  );
}
