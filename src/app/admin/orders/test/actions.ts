"use server";

import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computePriceForWebsiteProduct } from "@/lib/pricing";
import { extractLinkFromBody } from "@/lib/wordpress";
import { sanitizeArticleBody } from "@/lib/sanitizeArticle";
import { TEST_CUSTOMER_EMAIL } from "@/lib/testCustomer";
import { maybeAutoPublishOrder, finalizeOrderIfFullyPublished } from "@/lib/orderFulfillment";
import { z } from "zod";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  return session?.user.role === "admin";
}

async function getOrCreateTestCustomer(): Promise<{ userId: string; projectId: string }> {
  const existing = await prisma.user.findUnique({
    where: { email: TEST_CUSTOMER_EMAIL },
    include: { company: { include: { projects: true } } },
  });
  if (existing?.company) {
    const project =
      existing.company.projects[0] ??
      (await prisma.project.create({ data: { name: "Testorders", customerCompanyId: existing.company.id } }));
    return { userId: existing.id, projectId: project.id };
  }

  const role = await prisma.role.findUnique({ where: { name: "customer" } });
  if (!role) throw new Error("Rol 'customer' bestaat niet.");

  const passwordHash = await bcrypt.hash(randomBytes(32).toString("hex"), 12);

  return prisma.$transaction(async (tx) => {
    const company = await tx.company.create({ data: { name: "Testklant (admin)", type: "CUSTOMER" } });
    const user = await tx.user.create({
      data: {
        email: TEST_CUSTOMER_EMAIL,
        passwordHash,
        name: "Testklant",
        roleId: role.id,
        companyId: company.id,
        emailVerifiedAt: new Date(),
      },
    });
    const project = await tx.project.create({ data: { name: "Testorders", customerCompanyId: company.id } });
    return { userId: user.id, projectId: project.id };
  });
}

const createTestOrderSchema = z.object({
  websiteProductId: z.string().cuid(),
  wpCategoryId: z.string().cuid().optional().or(z.literal("")),
  articleTitle: z.string().trim().min(1, "Titel is verplicht").max(300),
  articleBody: z
    .string()
    .trim()
    .max(100000)
    .refine((html) => html.replace(/<[^>]*>/g, "").trim().length > 0, "Tekst is verplicht"),
  articleImageKey: z
    .string()
    .regex(/^[0-9a-f-]{36}\.(png|jpg|jpeg|webp|gif)$/i)
    .optional()
    .or(z.literal("")),
});

export type CreateTestOrderState = { error: string | null; success: boolean; orderId?: string };

// Creates an order that's PAID from the moment it exists — skips
// checkout/Stripe entirely, exactly like a real order except for that one
// step, so the rest of the pipeline (WP Sync draft, publish detection,
// order-published email) runs for real.
export async function adminCreateTestOrderAction(input: unknown): Promise<CreateTestOrderState> {
  if (!(await requireAdmin())) return { error: "Niet toegestaan.", success: false };

  const parsed = createTestOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer", success: false };
  }
  const data = parsed.data;

  const sanitizedBody = sanitizeArticleBody(data.articleBody);
  const link = extractLinkFromBody(sanitizedBody);

  const websiteProduct = await prisma.websiteProduct.findUnique({
    where: { id: data.websiteProductId },
    include: { website: true },
  });
  if (!websiteProduct) {
    return { error: "Onbekend product.", success: false };
  }

  let wpTermId: number | null = null;
  let wpCategoryNameSnap: string | null = null;
  if (data.wpCategoryId) {
    const wpCategory = await prisma.wpCategory.findUnique({ where: { id: data.wpCategoryId } });
    if (!wpCategory || wpCategory.websiteId !== websiteProduct.websiteId || wpCategory.kind !== "BLOG_POST") {
      return { error: "Ongeldige categorie.", success: false };
    }
    wpTermId = wpCategory.wpTermId;
    wpCategoryNameSnap = wpCategory.name;
  }

  const { supplierPrice, customerPrice, marginPercent } = await computePriceForWebsiteProduct(websiteProduct.id);
  const { userId, projectId } = await getOrCreateTestCustomer();

  const order = await prisma.order.create({
    data: {
      customerId: userId,
      projectId,
      status: "PAID",
      paidAt: new Date(),
      items: {
        create: {
          websiteProductId: websiteProduct.id,
          supplierPriceSnap: supplierPrice,
          customerPriceSnap: customerPrice,
          marginSnap: marginPercent,
          targetUrl: link?.targetUrl ?? null,
          anchorText: link?.anchorText ?? null,
          wpTermId,
          wpCategoryNameSnap,
          contentSource: "CUSTOMER",
          articleTitle: data.articleTitle,
          articleBody: sanitizedBody,
          articleImageKey: data.articleImageKey || null,
        },
      },
    },
  });

  // Behaves exactly like a real checkout from here on: if auto-publish is
  // on, this queues (or, for a non-WP-Sync site, directly publishes) the
  // item the same way a real order would — no separate manual step just
  // because it's a test order.
  await maybeAutoPublishOrder(order.id);
  await finalizeOrderIfFullyPublished(order.id);

  return { error: null, success: true, orderId: order.id };
}
