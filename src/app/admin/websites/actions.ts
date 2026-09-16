"use server";

import { getServerSession } from "next-auth";
import { CompanyType, ProductType, WebsiteStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createWebsiteSchema, addWebsiteProductSchema } from "@/lib/validations/website";
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
