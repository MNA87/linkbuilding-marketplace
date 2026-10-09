import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { refreshVatCheck } from "@/lib/vatCheck";
import { type AccountDetails, invoiceDetailsOf } from "@/lib/validations/account";

// "Mijn gegevens" saved — by the customer on Account, or by the admin on
// the customer's page: the person, and what goes on the invoices. A new
// VAT number, company name or country is checked again with VIES; the
// result is returned. invoiceEmail: where the verzamelfactuur goes (null =
// the customer's own address).
export async function saveCustomerDetails(
  userId: string,
  companyId: string,
  data: AccountDetails,
  invoiceEmail: string | null
): Promise<string> {
  const before = await prisma.company.findUnique({ where: { id: companyId } });
  const invoice = { ...invoiceDetailsOf(data), invoiceEmail };
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { name: data.name, phone: data.phone, address: data.address, postcode: data.postcode, city: data.city },
    }),
    prisma.company.update({ where: { id: companyId }, data: invoice }),
  ]);
  const changed =
    !before ||
    before.vatNumber !== invoice.vatNumber ||
    before.name !== invoice.name ||
    before.country !== invoice.country ||
    before.isBusiness !== invoice.isBusiness;
  return changed ? await refreshVatCheck(companyId) : before.vatStatus;
}

// The customer's first account: the one whose details the admin fills in
// and who gets the invitation.
export function primaryUserOf(companyId: string) {
  return prisma.user.findFirst({ where: { companyId }, orderBy: { createdAt: "asc" } });
}

// "Facturen naar" from the form: empty is fine (the own address), else a
// valid address, kept in lower case.
export function parseInvoiceEmail(input: unknown): { value: string | null; error: string | null } {
  const raw = (input as { invoiceEmail?: unknown } | null)?.invoiceEmail;
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!value) return { value: null, error: null };
  return z.string().email().safeParse(value).success
    ? { value, error: null }
    : { value: null, error: "Vul bij Facturen naar een geldig e-mailadres in." };
}
