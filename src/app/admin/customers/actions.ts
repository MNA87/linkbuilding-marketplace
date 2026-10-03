"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
