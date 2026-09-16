"use server";

import { getServerSession } from "next-auth";
import sanitizeHtml from "sanitize-html";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computePriceForWebsiteProduct } from "@/lib/pricing";
import { createOrderSchema } from "@/lib/validations/order";

// The rich text editor's HTML comes from the browser, so it's never trusted
// as-is — strip everything except the formatting the editor itself can
// produce before this ever reaches the database, the admin dashboard, or a
// live WordPress post.
// Article images are only ever inserted through the editor's own upload
// button (src/app/api/upload/article-image), which always returns a
// /api/article-images/<uuid>.<ext> path — anything else is rejected here so
// an <img> tag can never make the server fetch an attacker-controlled URL
// when it's later re-uploaded to WordPress's Media Library at publish time.
const ARTICLE_IMAGE_SRC = /^\/api\/article-images\/[0-9a-f-]{36}\.(png|jpg|jpeg|webp|gif)$/i;

function sanitizeArticleBody(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "p",
      "br",
      "strong",
      "em",
      "b",
      "i",
      "u",
      "a",
      "span",
      "mark",
      "ul",
      "ol",
      "li",
      "h1",
      "h2",
      "h3",
      "blockquote",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "img",
    ],
    allowedAttributes: {
      a: ["href"],
      img: ["src", "alt", "data-key"],
      th: ["colspan", "rowspan"],
      td: ["colspan", "rowspan"],
      "*": ["style"],
    },
    allowedStyles: {
      "*": { "text-align": [/^left$|^center$|^right$|^justify$/] },
      span: { color: [/^#[0-9a-f]{3,8}$/i] },
      mark: { "background-color": [/^#[0-9a-f]{3,8}$/i] },
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: { a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }) },
    exclusiveFilter: (frame) => {
      if (frame.tag !== "img") return false;
      return !ARTICLE_IMAGE_SRC.test(frame.attribs.src || "");
    },
  });
}

// The target URL/anchor text used to be separate form fields — now they
// come straight from the link the customer inserted in the editor itself
// (select text, click the link icon), so there's exactly one place to set
// where the link points instead of two that could disagree.
function extractLink(sanitizedBody: string): { targetUrl: string; anchorText: string } | null {
  const match = sanitizedBody.match(/<a\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
  if (!match) return null;
  const anchorText = match[2].replace(/<[^>]*>/g, "").trim();
  if (!anchorText) return null;
  return { targetUrl: match[1], anchorText };
}

export type AddToCartState = { error: string | null; success: boolean; orderId?: string };

// Adds an item to the customer's cart. A "cart" is just an Order with
// status NEW — there's one active cart per project, items get appended to
// it until checkout. Every customer company gets a single shared project
// (created lazily here) since the order form no longer asks for one.
export async function addToCartAction(input: unknown): Promise<AddToCartState> {
  const session = await getServerSession(authOptions);
  // Explicit role check — never rely on middleware alone for anything that
  // touches money or creates orders on someone's behalf.
  if (!session || session.user.role !== "customer" || !session.user.companyId) {
    return { error: "Niet toegestaan.", success: false };
  }

  const parsed = createOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer", success: false };
  }
  const data = parsed.data;

  const sanitizedBody = sanitizeArticleBody(data.articleBody);
  const link = extractLink(sanitizedBody);
  if (!link) {
    return { error: "Voeg een link naar je site toe in de tekst via het link-icoon.", success: false };
  }

  const websiteProduct = await prisma.websiteProduct.findUnique({
    where: { id: data.websiteProductId },
    include: { website: { include: { company: true } } },
  });
  if (!websiteProduct || !websiteProduct.isAvailable || websiteProduct.website.status !== "ACTIVE") {
    return { error: "Dit product is niet (meer) beschikbaar.", success: false };
  }

  // Never trust a price from the client — recompute server-side from the
  // current supplier price + margin rules, and freeze it on the item so a
  // later price change doesn't alter items already sitting in the cart.
  const { supplierPrice, customerPrice, marginPercent } = await computePriceForWebsiteProduct(
    websiteProduct.id
  );

  const order = await prisma.$transaction(async (tx) => {
    let project = await tx.project.findFirst({ where: { customerCompanyId: session.user.companyId! } });
    if (!project) {
      project = await tx.project.create({
        data: { name: "Bestellingen", customerCompanyId: session.user.companyId! },
      });
    }

    const existingCart = await tx.order.findFirst({
      where: { customerId: session.user.id, projectId: project.id, status: "NEW" },
    });

    const itemData = {
      websiteProductId: websiteProduct.id,
      supplierPriceSnap: supplierPrice,
      customerPriceSnap: customerPrice,
      marginSnap: marginPercent,
      targetUrl: link.targetUrl,
      anchorText: link.anchorText,
      comments: data.comments || null,
      contentSource: "CUSTOMER" as const,
      articleTitle: data.articleTitle,
      articleBody: sanitizedBody,
      uploadedFileUrl: data.uploadedFileUrl || null,
    };

    if (existingCart) {
      await tx.orderItem.create({ data: { ...itemData, orderId: existingCart.id } });
      return existingCart;
    }

    return tx.order.create({
      data: { customerId: session.user.id, projectId: project.id, items: { create: itemData } },
    });
  });

  return { error: null, success: true, orderId: order.id };
}
