"use server";

import { getServerSession } from "next-auth";
import { ProductType } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createWebsiteSchema, addWebsiteProductSchema } from "@/lib/validations/website";

export type ActionState = { error: string | null; success: boolean; id?: string };

export async function createWebsiteAction(input: unknown): Promise<ActionState> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "supplier" || !session.user.companyId) {
    return { error: "Niet toegestaan.", success: false };
  }

  const parsed = createWebsiteSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer", success: false };
  }
  const data = parsed.data;

  const existing = await prisma.website.findUnique({ where: { domain: data.domain } });
  if (existing) {
    return { error: "Dit domein staat al geregistreerd.", success: false };
  }

  const product = await prisma.product.findUnique({ where: { type: data.productType as ProductType } });
  if (!product) {
    return { error: "Onbekend producttype.", success: false };
  }

  const website = await prisma.website.create({
    data: {
      domain: data.domain,
      description: data.description || null,
      companyId: session.user.companyId,
      categoryId: data.categoryId,
      countryId: data.countryId,
      languageId: data.languageId,
      metrics: {
        create: {
          domainRating: data.domainRating,
          domainAuthority: data.domainAuthority,
          organicTraffic: data.organicTraffic,
          referringDomains: data.referringDomains,
          source: "manual",
        },
      },
      websiteProducts: {
        create: {
          productId: product.id,
          supplierPrice: data.supplierPrice,
          config: {
            minWords: data.minWords ?? null,
            maxWords: data.maxWords ?? null,
            maxLinks: data.maxLinks,
            dofollow: data.dofollow,
            permanent: data.permanent,
          },
        },
      },
    },
  });

  return { error: null, success: true, id: website.id };
}

export async function addWebsiteProductAction(input: unknown): Promise<ActionState> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "supplier" || !session.user.companyId) {
    return { error: "Niet toegestaan.", success: false };
  }

  const parsed = addWebsiteProductSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer", success: false };
  }
  const data = parsed.data;

  const website = await prisma.website.findUnique({ where: { id: data.websiteId } });
  if (!website || website.companyId !== session.user.companyId) {
    return { error: "Niet toegestaan.", success: false };
  }

  const product = await prisma.product.findUnique({ where: { type: data.productType as ProductType } });
  if (!product) {
    return { error: "Onbekend producttype.", success: false };
  }

  const existing = await prisma.websiteProduct.findUnique({
    where: { websiteId_productId: { websiteId: data.websiteId, productId: product.id } },
  });
  if (existing) {
    return { error: "Dit producttype bestaat al voor deze website.", success: false };
  }

  await prisma.websiteProduct.create({
    data: {
      websiteId: data.websiteId,
      productId: product.id,
      supplierPrice: data.supplierPrice,
      config: {
        minWords: data.minWords ?? null,
        maxWords: data.maxWords ?? null,
        maxLinks: data.maxLinks,
        dofollow: data.dofollow,
        permanent: data.permanent,
      },
    },
  });

  return { error: null, success: true };
}

export async function toggleWebsiteProductAvailabilityAction(
  websiteProductId: string
): Promise<ActionState> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "supplier" || !session.user.companyId) {
    return { error: "Niet toegestaan.", success: false };
  }

  const wp = await prisma.websiteProduct.findUnique({
    where: { id: websiteProductId },
    include: { website: true },
  });
  if (!wp || wp.website.companyId !== session.user.companyId) {
    return { error: "Niet toegestaan.", success: false };
  }

  await prisma.websiteProduct.update({
    where: { id: websiteProductId },
    data: { isAvailable: !wp.isAvailable },
  });

  return { error: null, success: true };
}
