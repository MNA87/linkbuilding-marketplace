"use server";

import { getServerSession } from "next-auth";
import { CompanyType, Prisma, ProductType, WebsiteStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createWebsiteSchema, addWebsiteProductSchema, editWebsiteProductPriceSchema } from "@/lib/validations/website";
import { editWebsiteSchema } from "@/lib/validations/websiteEdit";

export type ActionState = { error: string | null; success: boolean; id?: string };

export async function updateWebsiteStatusAction(
  websiteId: string,
  status: WebsiteStatus
): Promise<{ error: string | null; success: boolean }> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return { error: "Niet toegestaan.", success: false };
  }

  const validTransitions: WebsiteStatus[] = ["SUBMITTED", "APPROVED", "ACTIVE", "PAUSED", "REJECTED"];
  if (!validTransitions.includes(status)) {
    return { error: "Ongeldige status.", success: false };
  }

  await prisma.website.update({ where: { id: websiteId }, data: { status } });
  return { error: null, success: true };
}

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  return session?.user.role === "admin";
}

// Websites the admin manages directly (no separate publisher account) all
// belong to one internal company — there's conceptually one seller, the
// platform operator. Reuses "Eigen sites" from the seed if it exists so
// admin-added sites end up alongside the seeded example ones.
async function getOrCreateOperatorCompanyId(): Promise<string> {
  const existing = await prisma.company.findFirst({
    where: { type: CompanyType.PUBLISHER, name: "Eigen sites" },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing.id;

  const anyPublisher = await prisma.company.findFirst({
    where: { type: CompanyType.PUBLISHER },
    orderBy: { createdAt: "asc" },
  });
  if (anyPublisher) return anyPublisher.id;

  const created = await prisma.company.create({
    data: { name: "Eigen sites", type: CompanyType.PUBLISHER },
  });
  return created.id;
}

export async function adminCreateWebsiteAction(input: unknown): Promise<ActionState> {
  if (!(await requireAdmin())) return { error: "Niet toegestaan.", success: false };

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

  const companyId = await getOrCreateOperatorCompanyId();

  const website = await prisma.website.create({
    data: {
      domain: data.domain,
      description: data.description || null,
      // Admin-added sites are the operator's own — skip the SUBMITTED
      // review queue a third-party supplier's site would go through.
      status: "ACTIVE",
      companyId,
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

export async function adminAddWebsiteProductAction(input: unknown): Promise<ActionState> {
  if (!(await requireAdmin())) return { error: "Niet toegestaan.", success: false };

  const parsed = addWebsiteProductSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer", success: false };
  }
  const data = parsed.data;

  const website = await prisma.website.findUnique({ where: { id: data.websiteId } });
  if (!website) {
    return { error: "Niet toegestaan.", success: false };
  }

  const product = await prisma.product.findUnique({ where: { type: data.productType as ProductType } });
  if (!product) {
    return { error: "Onbekend producttype.", success: false };
  }

  const existingProduct = await prisma.websiteProduct.findUnique({
    where: { websiteId_productId: { websiteId: data.websiteId, productId: product.id } },
  });
  if (existingProduct) {
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

export async function adminEditWebsiteAction(input: unknown): Promise<ActionState> {
  if (!(await requireAdmin())) return { error: "Niet toegestaan.", success: false };

  const parsed = editWebsiteSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer", success: false };
  }
  const data = parsed.data;

  const website = await prisma.website.findUnique({ where: { id: data.websiteId } });
  if (!website) {
    return { error: "Niet toegestaan.", success: false };
  }

  if (data.domain !== website.domain) {
    const existing = await prisma.website.findUnique({ where: { domain: data.domain } });
    if (existing) {
      return { error: "Dit domein staat al geregistreerd.", success: false };
    }
  }

  await prisma.website.update({
    where: { id: data.websiteId },
    data: {
      domain: data.domain,
      description: data.description || null,
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
    },
  });

  return { error: null, success: true, id: data.websiteId };
}

export async function adminSetWordpressConnectionAction(input: {
  websiteId: string;
  wordpressUrl: string;
  wordpressUsername: string;
  wordpressAppPassword: string;
  publishBridgeSecret?: string;
}): Promise<ActionState> {
  if (!(await requireAdmin())) return { error: "Niet toegestaan.", success: false };

  const websiteId = input.websiteId?.trim();
  const wordpressUrl = input.wordpressUrl?.trim().replace(/\/$/, "");
  const wordpressUsername = input.wordpressUsername?.trim();
  const wordpressAppPassword = input.wordpressAppPassword?.trim();
  const publishBridgeSecret = input.publishBridgeSecret?.trim();

  if (!websiteId || !wordpressUrl || !wordpressUsername) {
    return { error: "Vul URL en gebruikersnaam in.", success: false };
  }
  if (!/^https?:\/\//.test(wordpressUrl)) {
    return { error: "URL moet met http:// of https:// beginnen.", success: false };
  }

  const website = await prisma.website.findUnique({ where: { id: websiteId } });
  if (!website) return { error: "Niet toegestaan.", success: false };

  // Leaving the password field blank when editing an already-connected site
  // keeps the existing one instead of wiping it.
  const finalAppPassword = wordpressAppPassword || website.wordpressAppPassword;
  if (!finalAppPassword) {
    return { error: "Vul een application password in.", success: false };
  }
  // Same for the (optional) publish bridge secret.
  const finalBridgeSecret = publishBridgeSecret || website.publishBridgeSecret;

  await prisma.website.update({
    where: { id: websiteId },
    data: {
      wordpressUrl,
      wordpressUsername,
      wordpressAppPassword: finalAppPassword,
      publishBridgeSecret: finalBridgeSecret || null,
    },
  });

  return { error: null, success: true };
}

export async function adminRemoveWordpressConnectionAction(websiteId: string): Promise<ActionState> {
  if (!(await requireAdmin())) return { error: "Niet toegestaan.", success: false };

  await prisma.website.update({
    where: { id: websiteId },
    data: { wordpressUrl: null, wordpressUsername: null, wordpressAppPassword: null, publishBridgeSecret: null },
  });

  return { error: null, success: true };
}

export async function adminEditWebsiteProductPriceAction(input: unknown): Promise<ActionState> {
  if (!(await requireAdmin())) return { error: "Niet toegestaan.", success: false };

  const parsed = editWebsiteProductPriceSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer", success: false };
  }

  const wp = await prisma.websiteProduct.findUnique({ where: { id: parsed.data.websiteProductId } });
  if (!wp) return { error: "Niet toegestaan.", success: false };

  await prisma.websiteProduct.update({
    where: { id: parsed.data.websiteProductId },
    data: { supplierPrice: parsed.data.supplierPrice },
  });

  return { error: null, success: true };
}

export async function adminToggleWebsiteProductAvailabilityAction(websiteProductId: string): Promise<ActionState> {
  if (!(await requireAdmin())) return { error: "Niet toegestaan.", success: false };

  const wp = await prisma.websiteProduct.findUnique({ where: { id: websiteProductId } });
  if (!wp) {
    return { error: "Niet toegestaan.", success: false };
  }

  await prisma.websiteProduct.update({
    where: { id: websiteProductId },
    data: { isAvailable: !wp.isAvailable },
  });

  return { error: null, success: true };
}

export async function adminDeleteWebsiteProductAction(websiteProductId: string): Promise<ActionState> {
  if (!(await requireAdmin())) return { error: "Niet toegestaan.", success: false };

  try {
    await prisma.websiteProduct.delete({ where: { id: websiteProductId } });
    return { error: null, success: true };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      return { error: "Dit product heeft nog orders en kan niet verwijderd worden. Zet 'm op inactief.", success: false };
    }
    return { error: "Verwijderen mislukt.", success: false };
  }
}

export async function adminDeleteWebsiteAction(websiteId: string): Promise<ActionState> {
  if (!(await requireAdmin())) return { error: "Niet toegestaan.", success: false };

  try {
    await prisma.website.delete({ where: { id: websiteId } });
    return { error: null, success: true };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      return {
        error: "Deze website heeft nog orders of prijsregels en kan niet verwijderd worden. Zet 'm op gepauzeerd.",
        success: false,
      };
    }
    return { error: "Verwijderen mislukt.", success: false };
  }
}
