"use server";

import { getServerSession } from "next-auth";
import { CompanyType, Prisma, WebsiteStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { refreshWebsiteMetrics } from "@/lib/websiteMetrics";
import {
  normalizeDetails,
  normalizePrices,
  type PriceColumn,
  type WebsiteDetails,
} from "@/lib/validations/websiteAdmin";

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

export async function adminSetWordpressConnectionAction(input: {
  websiteId: string;
  wordpressUrl: string;
  wordpressUsername: string;
  wordpressAppPassword: string;
  wpSyncSecret?: string;
}): Promise<ActionState> {
  if (!(await requireAdmin())) return { error: "Niet toegestaan.", success: false };

  const websiteId = input.websiteId?.trim();
  const wordpressUrl = input.wordpressUrl?.trim().replace(/\/$/, "");
  const wordpressUsername = input.wordpressUsername?.trim();
  const wordpressAppPassword = input.wordpressAppPassword?.trim();
  const wpSyncSecret = input.wpSyncSecret?.trim();

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
  // Same for the (optional) WP Sync secret.
  const finalSyncSecret = wpSyncSecret || website.wpSyncSecret;

  try {
    await prisma.website.update({
      where: { id: websiteId },
      data: {
        wordpressUrl,
        wordpressUsername,
        wordpressAppPassword: finalAppPassword,
        wpSyncSecret: finalSyncSecret || null,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "Deze sync-sleutel is al bij een andere site in gebruik.", success: false };
    }
    throw err;
  }

  return { error: null, success: true };
}

export async function adminRemoveWordpressConnectionAction(websiteId: string): Promise<ActionState> {
  if (!(await requireAdmin())) return { error: "Niet toegestaan.", success: false };

  await prisma.website.update({
    where: { id: websiteId },
    data: { wordpressUrl: null, wordpressUsername: null, wordpressAppPassword: null, wpSyncSecret: null },
  });

  return { error: null, success: true };
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

// "Nu vernieuwen" on a website's page: fetch its figures right away.
export async function refreshWebsiteMetricsAction(websiteId: string): Promise<{ ok: boolean; message: string }> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") return { ok: false, message: "Niet toegestaan." };
  return refreshWebsiteMetrics(websiteId);
}

// ---------------------------------------------------------------------------
// The site's tabs "Gegevens" and "Prijzen", and "Nieuwe website" which does
// both at once. Checks are in src/lib/validations/websiteAdmin.ts.

type Tx = Prisma.TransactionClient;

// Whether the country, language and niches picked really exist.
async function checkReferences(details: WebsiteDetails): Promise<string | null> {
  const [country, language, niches] = await Promise.all([
    prisma.country.findUnique({ where: { id: details.countryId }, select: { id: true } }),
    prisma.language.findUnique({ where: { id: details.languageId }, select: { id: true } }),
    prisma.category.count({ where: { id: { in: [details.categoryId, ...details.extraNicheIds] } } }),
  ]);
  if (!country) return "Kies een land.";
  if (!language) return "Kies een taal.";
  if (niches !== 1 + details.extraNicheIds.length) return "Een van de niches bestaat niet (meer).";
  return null;
}

const detailsData = (d: WebsiteDetails) => ({
  domain: d.domain,
  description: d.description,
  countryId: d.countryId,
  languageId: d.languageId,
  categoryId: d.categoryId,
  maxLinks: d.maxLinks,
  sponsored: d.sponsored,
  exampleUrl: d.exampleUrl,
});

// Saves the "Prijzen" table: an offered product is created when missing,
// its price for Algemeen and "Duur" set; a product switched off is taken out
// of the marketplace (kept, since orders point to it). Topic prices: a price
// saves it, an empty one removes it (not placed).
async function applyPrices(tx: Tx, websiteId: string, columns: PriceColumn[]) {
  for (const c of columns) {
    const product = await tx.product.findUnique({ where: { type: c.type } });
    if (!product) continue;
    const existing = await tx.websiteProduct.findUnique({
      where: { websiteId_productId: { websiteId, productId: product.id } },
    });
    if (!c.enabled) {
      if (existing) await tx.websiteProduct.update({ where: { id: existing.id }, data: { isAvailable: false } });
      continue;
    }
    const wp = existing
      ? await tx.websiteProduct.update({
          where: { id: existing.id },
          data: { supplierPrice: c.general!, periodic: c.periodic, isAvailable: true },
        })
      : await tx.websiteProduct.create({
          data: { websiteId, productId: product.id, supplierPrice: c.general!, periodic: c.periodic, config: {} },
        });
    for (const t of c.topics) {
      if (t.price) {
        await tx.websiteProductTopicPrice.upsert({
          where: { websiteProductId_topicId: { websiteProductId: wp.id, topicId: t.topicId } },
          create: { websiteProductId: wp.id, topicId: t.topicId, price: t.price },
          update: { price: t.price },
        });
      } else {
        await tx.websiteProductTopicPrice.deleteMany({ where: { websiteProductId: wp.id, topicId: t.topicId } });
      }
    }
  }
}

export async function adminSaveWebsiteDetailsAction(websiteId: string, input: unknown): Promise<ActionState> {
  if (!(await requireAdmin())) return { error: "Niet toegestaan.", success: false };
  const r = normalizeDetails(input);
  if (!r.ok) return { error: r.error, success: false };
  const website = await prisma.website.findUnique({ where: { id: websiteId }, select: { id: true } });
  if (!website) return { error: "Website niet gevonden.", success: false };
  const refError = await checkReferences(r.data);
  if (refError) return { error: refError, success: false };
  const taken = await prisma.website.findFirst({
    where: { domain: r.data.domain, id: { not: websiteId } },
    select: { id: true },
  });
  if (taken) return { error: "Dit domein staat al bij een andere website.", success: false };

  await prisma.website.update({
    where: { id: websiteId },
    data: { ...detailsData(r.data), niches: { set: r.data.extraNicheIds.map((id) => ({ id })) } },
  });
  return { error: null, success: true };
}

export async function adminSavePricesAction(websiteId: string, input: unknown): Promise<ActionState> {
  if (!(await requireAdmin())) return { error: "Niet toegestaan.", success: false };
  const topics = await prisma.topic.findMany({ select: { id: true, name: true } });
  const r = normalizePrices(input, topics);
  if (!r.ok) return { error: r.error, success: false };
  const website = await prisma.website.findUnique({ where: { id: websiteId }, select: { id: true } });
  if (!website) return { error: "Website niet gevonden.", success: false };
  await prisma.$transaction((tx) => applyPrices(tx, websiteId, r.columns));
  return { error: null, success: true };
}

// "+ niche" while filling in a site: an existing one with that name, or a
// new one (Stamdata keeps the full list).
export async function adminAddNicheAction(
  name: string
): Promise<{ error: string | null; niche?: { id: string; name: string } }> {
  if (!(await requireAdmin())) return { error: "Niet toegestaan." };
  const clean = name.trim().replace(/\s+/g, " ");
  if (clean.length < 2 || clean.length > 50) return { error: "Een niche heeft 2 tot 50 tekens." };
  const label = clean.charAt(0).toUpperCase() + clean.slice(1);
  const existing = await prisma.category.findFirst({
    where: { name: { equals: label, mode: "insensitive" } },
    select: { id: true, name: true },
  });
  if (existing) return { error: null, niche: existing };
  const created = await prisma.category.create({ data: { name: label }, select: { id: true, name: true } });
  return { error: null, niche: created };
}

// "Nieuwe website": the details and prices at once; the site goes live in
// the marketplace straight away (the operator's own), and its figures are
// fetched in the background.
export async function adminCreateWebsiteAction(input: { details: unknown; prices: unknown }): Promise<ActionState> {
  if (!(await requireAdmin())) return { error: "Niet toegestaan.", success: false };
  const d = normalizeDetails(input.details);
  if (!d.ok) return { error: d.error, success: false };
  const topics = await prisma.topic.findMany({ select: { id: true, name: true } });
  const p = normalizePrices(input.prices, topics);
  if (!p.ok) return { error: p.error, success: false };
  if (!p.columns.some((c) => c.enabled)) return { error: "Bied minstens één product aan.", success: false };
  const refError = await checkReferences(d.data);
  if (refError) return { error: refError, success: false };
  if (await prisma.website.findUnique({ where: { domain: d.data.domain }, select: { id: true } })) {
    return { error: "Dit domein staat al geregistreerd.", success: false };
  }

  const companyId = await getOrCreateOperatorCompanyId();
  const website = await prisma.$transaction(async (tx) => {
    const created = await tx.website.create({
      data: {
        ...detailsData(d.data),
        status: "ACTIVE",
        companyId,
        niches: { connect: d.data.extraNicheIds.map((id) => ({ id })) },
      },
    });
    await applyPrices(tx, created.id, p.columns);
    return created;
  });

  void refreshWebsiteMetrics(website.id).catch((err) => console.error("metrics: ophalen mislukt", err));
  return { error: null, success: true, id: website.id };
}
