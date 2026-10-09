"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { refreshVatCheck } from "@/lib/vatCheck";
import { parseInvoiceEmail, primaryUserOf, saveCustomerDetails } from "@/lib/customerDetails";
import { sendInvite } from "@/lib/passwordReset";
import { type AccountDetails, parseAccountDetails } from "@/lib/validations/account";

// "1.234,50", "90" or "90.5" → a number; empty stays empty.
const amount = (max: number) =>
  z
    .string()
    .trim()
    .transform((v) =>
      v
        .replace(/\s|€/g, "")
        .replace(/\.(?=\d{3}(\D|$))/g, "")
        .replace(",", ".")
    )
    .refine((v) => v === "" || (/^\d+(\.\d{1,2})?$/.test(v) && Number(v) <= max), "Vul een geldig bedrag in");

const pricesSchema = z.object({
  companyId: z.string().min(1),
  discountPercent: amount(100),
  writingIncluded: z.boolean(),
  fixed: z.record(z.string().min(1), amount(100000)),
});

// The prices agreed with one customer: a discount on all sites, a fixed
// price per site/product (empty removes it) and whether writing is included.
// Only new orders get them; orders already made keep their prices.
export async function saveCustomerPricesAction(input: unknown): Promise<{ error: string | null }> {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "admin") return { error: "Niet toegestaan." };

  const parsed = pricesSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" };
  const { companyId, discountPercent, writingIncluded, fixed } = parsed.data;

  const company = await prisma.company.findFirst({ where: { id: companyId, type: "CUSTOMER" }, select: { id: true } });
  if (!company) return { error: "Klant niet gevonden." };
  const known = new Set(
    (await prisma.websiteProduct.findMany({ where: { id: { in: Object.keys(fixed) } }, select: { id: true } })).map(
      (p) => p.id
    )
  );

  await prisma.$transaction([
    prisma.company.update({
      where: { id: companyId },
      data: {
        discountPercent:
          discountPercent === "" || Number(discountPercent) === 0 ? null : new Prisma.Decimal(discountPercent),
        writingIncluded,
      },
    }),
    prisma.customerPrice.deleteMany({ where: { companyId } }),
    prisma.customerPrice.createMany({
      data: Object.entries(fixed)
        .filter(([id, price]) => price !== "" && known.has(id))
        .map(([websiteProductId, price]) => ({ companyId, websiteProductId, price: new Prisma.Decimal(price) })),
    }),
  ]);
  revalidatePath(`/admin/customers/${companyId}`);
  return { error: null };
}

// "Gegevens" on the customer's page: the admin fills in what the customer
// would under Account → Mijn gegevens (a customer by mail, say), so they
// only need to choose a password.
export async function saveCustomerDetailsAction(
  companyId: string,
  input: unknown
): Promise<{ error: string | null; success: boolean; saved?: AccountDetails; vatStatus?: string }> {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "admin") return { error: "Niet toegestaan.", success: false };
  const company = await prisma.company.findFirst({ where: { id: String(companyId), type: "CUSTOMER" } });
  const user = company ? await primaryUserOf(company.id) : null;
  if (!company || !user) return { error: "Klant niet gevonden.", success: false };
  const { data, error } = parseAccountDetails(input);
  if (!data) return { error, success: false };
  const invoiceEmail = parseInvoiceEmail(input);
  if (invoiceEmail.error) return { error: invoiceEmail.error, success: false };
  const vatStatus = await saveCustomerDetails(user.id, company.id, data, invoiceEmail.value);
  revalidatePath(`/admin/customers/${company.id}`);
  revalidatePath("/admin/customers");
  revalidatePath("/admin/invoices/collective");
  return { error: null, success: true, saved: data, vatStatus };
}

// "Uitnodigen": a mail to the customer (one made from a mail order) with a
// link to choose a password and order online. Not for an account that's
// already in use.
export async function inviteCustomerAction(companyId: string): Promise<{ error: string | null; message?: string }> {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "admin") return { error: "Niet toegestaan." };
  const company = await prisma.company.findFirst({ where: { id: String(companyId), type: "CUSTOMER" } });
  const user = company ? await primaryUserOf(company.id) : null;
  if (!company || !user || user.status !== "active") return { error: "Klant niet gevonden." };
  if (user.emailVerifiedAt) return { error: "Deze klant heeft al een actief account." };
  const hasOrders = (await prisma.order.count({ where: { customerId: user.id } })) > 0;
  if (!(await sendInvite(user, hasOrders))) {
    return { error: `Versturen aan ${user.email} is mislukt. Probeer het later nog eens.` };
  }
  revalidatePath(`/admin/customers/${company.id}`);
  return { error: null, message: `Uitnodiging verstuurd aan ${user.email}.` };
}

// Btw: check the customer's VAT number with VIES again, or decide yourself
// when VIES couldn't confirm it (approved = btw verlegd, invalid = 21%).
export async function setVatStatusAction(
  companyId: string,
  action: "recheck" | "approved" | "invalid"
): Promise<{ error: string | null }> {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "admin") return { error: "Niet toegestaan." };
  const company = await prisma.company.findFirst({ where: { id: String(companyId), type: "CUSTOMER" } });
  if (!company) return { error: "Klant niet gevonden." };
  if (action === "recheck") {
    await refreshVatCheck(company.id);
  } else if (action === "approved" || action === "invalid") {
    if (!company.vatNumber) return { error: "Deze klant heeft geen btw-nummer." };
    await prisma.company.update({ where: { id: company.id }, data: { vatStatus: action } });
  }
  revalidatePath(`/admin/customers/${company.id}`);
  revalidatePath("/admin", "layout");
  return { error: null };
}
