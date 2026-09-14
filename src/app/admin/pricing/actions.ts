"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ActionState = { error: string | null; success: boolean };

export async function setCategoryMarginAction(categoryId: string, marginPercent: number): Promise<ActionState> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return { error: "Niet toegestaan.", success: false };
  }
  if (!Number.isFinite(marginPercent) || marginPercent < 0 || marginPercent > 1000) {
    return { error: "Ongeldig marge-percentage.", success: false };
  }

  const existing = await prisma.pricingRule.findFirst({ where: { categoryId, websiteProductId: null } });
  if (existing) {
    await prisma.pricingRule.update({
      where: { id: existing.id },
      data: { defaultMarginPercent: marginPercent, manualCustomerPrice: null },
    });
  } else {
    await prisma.pricingRule.create({
      data: { categoryId, defaultMarginPercent: marginPercent },
    });
  }

  return { error: null, success: true };
}

export async function setManualPriceAction(
  websiteProductId: string,
  manualPrice: number | null
): Promise<ActionState> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return { error: "Niet toegestaan.", success: false };
  }
  if (manualPrice !== null && (!Number.isFinite(manualPrice) || manualPrice <= 0)) {
    return { error: "Ongeldige prijs.", success: false };
  }

  const existing = await prisma.pricingRule.findFirst({ where: { websiteProductId } });
  if (existing) {
    await prisma.pricingRule.update({
      where: { id: existing.id },
      data: { manualCustomerPrice: manualPrice },
    });
  } else if (manualPrice !== null) {
    await prisma.pricingRule.create({
      data: { websiteProductId, defaultMarginPercent: 0, manualCustomerPrice: manualPrice },
    });
  }

  return { error: null, success: true };
}
