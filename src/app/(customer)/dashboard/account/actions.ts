"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { billingDetailsSchema } from "@/lib/validations/billing";

export async function setBillingDetailsAction(
  input: unknown
): Promise<{ error: string | null; success: boolean; values?: Record<string, string> }> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer" || !session.user.companyId) {
    return { error: "Niet toegestaan.", success: false };
  }
  const parsed = billingDetailsSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ongeldig", success: false };

  await prisma.company.update({ where: { id: session.user.companyId }, data: parsed.data });
  return { error: null, success: true, values: { ...parsed.data, vatNumber: parsed.data.vatNumber ?? "" } };
}
