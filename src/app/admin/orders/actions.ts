"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startPlacementPeriod } from "@/lib/placementLifecycle";
import { extractLinkFromBody, publishToWordPress } from "@/lib/wordpress";
import { wpSlugify } from "@/lib/wpSlug";
import { finalizeOrderIfFullyPublished } from "@/lib/orderFulfillment";
import { z } from "zod";
import { ArticleWriterError, writeArticle } from "@/lib/articleWriter";
import { parseBriefLinks } from "@/lib/writingService";
import { sanitizeArticleBody } from "@/lib/sanitizeArticle";
import { TITLE_MAX_LENGTH } from "@/lib/validations/order";
import { messageBodySchema } from "@/lib/orderMessages";
import { cancelAndRefundOrder } from "@/lib/orderCancel";
import { articleToDocx } from "@/lib/articleDocx";
import { sendFromMailbox } from "@/lib/mailbox";
import { emailLayout, emailSenderFrom } from "@/lib/emailLayout";
import { sendNewMessageEmail } from "@/lib/email";
import { computePriceForWebsiteProduct, TopicNotOfferedError } from "@/lib/pricing";
import { priceForYears } from "@/lib/placementPeriod";

const publishSchema = z.object({
  orderItemId: z.string().cuid(),
  liveUrl: z.string().trim().url("Vul een geldige URL in"),
});

const publishToWpSchema = z.object({
  orderItemId: z.string().cuid(),
});

const setArchivedSchema = z.object({
  orderIds: z.array(z.string().cuid()).min(1),
  archived: z.boolean(),
});

// Bulk archive/unarchive from the compact Admin -> Orders overview, so the
// admin can clean up their own view without waiting for an order to reach a
// terminal status (see OrdersTable.tsx for the selection UI).
export async function adminSetOrdersArchivedAction(
  input: unknown
): Promise<{ error: string | null; success: boolean }> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return { error: "Niet toegestaan.", success: false };
  }

  const parsed = setArchivedSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Ongeldige invoer", success: false };
  }

  await prisma.order.updateMany({
    where: { id: { in: parsed.data.orderIds } },
    data: { archivedAt: parsed.data.archived ? new Date() : null },
  });

  return { error: null, success: true };
}

// One-click publish for an already-paid order — the payment webhook only
// auto-publishes when the admin has switched that on globally (Admin ->
// Instellingen); this is the on-demand equivalent for a single order, e.g.
// after manually reviewing the content, or for a test order placed while
// auto-publish was off.
//
// A site with a WP Sync secret set (see Website.wpSyncSecret) pulls its own
// pending orders instead of us pushing to it — this just marks the item
// ready; actual publishing happens on the site's next sync (its cron, or an
// admin clicking "Nu synchroniseren" in its own wp-admin). `queued: true` in
// the result tells the caller it's not live yet, just queued.
export async function adminPublishToWordPressAction(
  input: unknown
): Promise<{ error: string | null; success: boolean; queued?: boolean }> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return { error: "Niet toegestaan.", success: false };
  }

  const parsed = publishToWpSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Ongeldige invoer", success: false };
  }

  const orderItem = await prisma.orderItem.findUnique({
    where: { id: parsed.data.orderItemId },
    include: { order: true, placement: true, websiteProduct: { include: { website: true, product: true } } },
  });
  if (!orderItem) return { error: "Niet toegestaan.", success: false };
  if (orderItem.order.status === "NEW") {
    return { error: "Deze order is nog niet betaald.", success: false };
  }
  if (orderItem.placement) return { error: "Dit staat al op de site.", success: false };

  const website = orderItem.websiteProduct.website;
  // A homepage-link is placed by the plugin only (it renders the startpagina).
  if (orderItem.websiteProduct.product.type === "HOMEPAGE_LINK") {
    if (!orderItem.anchorText || !orderItem.targetUrl) {
      return { error: "Vul eerst de ankertekst en de doel-URL in.", success: false };
    }
    if (!website.wpSyncSecret) {
      return {
        error: "Homepage-links worden geplaatst via de Nugevonden-plugin; die staat niet op deze site.",
        success: false,
      };
    }
    await prisma.orderItem.update({ where: { id: orderItem.id }, data: { readyToPublish: true } });
    return { error: null, success: true, queued: true };
  }
  if (!orderItem.articleTitle || !orderItem.articleBody) {
    return { error: "Geen content om te publiceren.", success: false };
  }

  if (website.wpSyncSecret) {
    await prisma.orderItem.update({ where: { id: orderItem.id }, data: { readyToPublish: true } });
    console.log(
      `Queued ${orderItem.id} for ${website.domain} (${website.id}), publishAt=${orderItem.publishAt?.toISOString() ?? "direct"}`
    );
    return { error: null, success: true, queued: true };
  }

  if (!website.wordpressUrl || !website.wordpressUsername || !website.wordpressAppPassword) {
    return { error: "Deze site heeft geen WordPress-koppeling.", success: false };
  }

  try {
    const { liveUrl } = await publishToWordPress(
      {
        wordpressUrl: website.wordpressUrl,
        wordpressUsername: website.wordpressUsername,
        wordpressAppPassword: website.wordpressAppPassword,
      },
      {
        title: orderItem.articleTitle,
        body: orderItem.articleBody,
        targetUrl: orderItem.targetUrl,
        anchorText: orderItem.anchorText,
        nofollow: orderItem.nofollow,
        imageKey: orderItem.articleImageKey,
        wpTermId: orderItem.wpTermId,
        slug: orderItem.articleSlug,
      }
    );

    await prisma.placement.upsert({
      where: { orderItemId: orderItem.id },
      create: { orderItemId: orderItem.id, liveUrl, publishedAt: new Date(), status: "published" },
      update: { liveUrl, publishedAt: new Date(), status: "published" },
    });

    await startPlacementPeriod(orderItem.id);
    await finalizeOrderIfFullyPublished(orderItem.order.id);

    return { error: null, success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Publiceren mislukt.";
    return { error: message, success: false };
  }
}

// Lets an admin pull a queued item back out of the WP Sync queue before the
// site's next poll picks it up — e.g. a stale test order that was
// accidentally left in readyToPublish state. See the "Dat mag nooit meer
// gebeuren" incident: multiple old test orders sat queued for hours and the
// site published one of them instead of the intended order once sync
// resumed.
export async function adminCancelReadyToPublishAction(
  input: unknown
): Promise<{ error: string | null; success: boolean }> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return { error: "Niet toegestaan.", success: false };
  }

  const parsed = publishToWpSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Ongeldige invoer", success: false };
  }

  await prisma.orderItem.update({
    where: { id: parsed.data.orderItemId },
    data: { readyToPublish: false },
  });

  return { error: null, success: true };
}

export async function adminMarkPlacementPublishedAction(
  input: unknown
): Promise<{ error: string | null; success: boolean }> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return { error: "Niet toegestaan.", success: false };
  }

  const parsed = publishSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer", success: false };
  }

  const orderItem = await prisma.orderItem.findUnique({
    where: { id: parsed.data.orderItemId },
    include: { order: true },
  });
  if (!orderItem) return { error: "Niet toegestaan.", success: false };
  if (orderItem.order.status === "NEW") {
    return { error: "Deze order is nog niet betaald.", success: false };
  }

  await prisma.placement.upsert({
    where: { orderItemId: orderItem.id },
    create: { orderItemId: orderItem.id, liveUrl: parsed.data.liveUrl, publishedAt: new Date(), status: "published" },
    update: { liveUrl: parsed.data.liveUrl, publishedAt: new Date(), status: "published" },
  });

  await startPlacementPeriod(orderItem.id);
  await finalizeOrderIfFullyPublished(orderItem.order.id);

  return { error: null, success: true };
}

// "Laat ons schrijven": a first draft from OpenAI, around the customer's
// links. Nothing is saved here — the admin reads and edits it first.
export async function adminWriteArticleAction(
  input: unknown
): Promise<{ error: string | null; title?: string; html?: string }> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") return { error: "Niet toegestaan." };

  const parsed = publishToWpSchema.safeParse(input);
  if (!parsed.success) return { error: "Ongeldige invoer" };

  const item = await prisma.orderItem.findUnique({
    where: { id: parsed.data.orderItemId },
    include: { websiteProduct: { include: { website: true } } },
  });
  const links = parseBriefLinks(item?.briefLinks);
  if (!item || !item.writeForMe || links.length === 0) return { error: "Geen briefing voor deze order." };

  try {
    const article = await writeArticle({
      domain: item.websiteProduct.website.domain,
      category: item.wpCategoryNameSnap,
      links,
    });
    return { error: null, ...article };
  } catch (err) {
    if (err instanceof ArticleWriterError) return { error: err.message };
    console.error("adminWriteArticleAction failed", err);
    return { error: "Schrijven mislukt. Probeer het opnieuw." };
  }
}

const saveArticleSchema = z.object({
  orderItemId: z.string().cuid(),
  kind: z.literal("article"),
  articleTitle: z
    .string()
    .trim()
    .min(1, "Titel is verplicht")
    .max(TITLE_MAX_LENGTH, `Titel mag maximaal ${TITLE_MAX_LENGTH} tekens zijn`),
  articleSlug: z.string().trim().max(190).optional().or(z.literal("")),
  articleBody: z.string().trim().max(100000),
  articleImageKey: z
    .string()
    .regex(/^[0-9a-f-]{36}\.(png|jpg|jpeg|webp|gif)$/i)
    .optional()
    .or(z.literal("")),
});

const saveLinkSchema = z.object({
  orderItemId: z.string().cuid(),
  kind: z.literal("link"),
  anchorText: z.string().trim().min(1, "Ankertekst is verplicht").max(200),
  targetUrl: z.string().trim().url("Vul een geldige URL in"),
  nofollow: z.boolean(),
});

const saveItemSchema = z.discriminatedUnion("kind", [saveArticleSchema, saveLinkSchema]);

const CLOSED_STATUSES = ["NEW", "CANCELLED", "REJECTED", "REFUND_REQUESTED"];

// The admin checks and, where needed, changes what a customer ordered: the
// article (title, URL, text, picture) or the homepage-link (anchor text,
// URL, dofollow). Before it's placed that's simply what goes out on
// Publiceren; once it's on the site (only via the plugin), the site takes
// over the new version on its next sync.
export async function adminSaveItemAction(input: unknown): Promise<{ error: string | null; success: boolean }> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") return { error: "Niet toegestaan.", success: false };

  const parsed = saveItemSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer", success: false };
  }
  const data = parsed.data;

  const item = await prisma.orderItem.findUnique({
    where: { id: data.orderItemId },
    include: { order: true, placement: true, websiteProduct: { include: { website: true, product: true } } },
  });
  if (!item) return { error: "Niet toegestaan.", success: false };
  if (CLOSED_STATUSES.includes(item.order.status)) {
    return { error: "Deze order is niet (meer) actief.", success: false };
  }
  const isLink = item.websiteProduct.product.type === "HOMEPAGE_LINK";
  if (isLink !== (data.kind === "link")) return { error: "Niet toegestaan.", success: false };
  // Queued: the site may be fetching it right now — take it back first.
  if (item.readyToPublish && !item.placement) {
    return {
      error: "Dit staat klaar om gepubliceerd te worden. Klik eerst op 'Toch niet publiceren'.",
      success: false,
    };
  }
  if (item.placement?.status === "expired") {
    return { error: "Deze plaatsing is verlopen en staat niet meer op de site.", success: false };
  }
  const placed = Boolean(item.placement);
  if (placed && !item.websiteProduct.website.wpSyncSecret) {
    return { error: "Bijwerken op de site kan alleen bij sites met de Nugevonden-plugin.", success: false };
  }

  if (data.kind === "link") {
    await prisma.orderItem.update({
      where: { id: item.id },
      data: {
        anchorText: data.anchorText,
        targetUrl: data.targetUrl,
        nofollow: data.nofollow,
        ...(placed ? { updatePending: true } : {}),
      },
    });
    return { error: null, success: true };
  }

  const body = sanitizeArticleBody(data.articleBody);
  if (!body.replace(/<[^>]*>/g, "").trim()) return { error: "Tekst is verplicht", success: false };
  // The link the customer put in the text is the one the order is about
  // ("Laat ons schrijven" keeps the links from its briefing).
  const link = extractLinkFromBody(body);
  const slug = wpSlugify(data.articleSlug ?? "");
  await prisma.orderItem.update({
    where: { id: item.id },
    data: {
      articleTitle: data.articleTitle,
      articleBody: body,
      articleImageKey: data.articleImageKey || null,
      // Only kept when it differs from what the title would give anyway.
      articleSlug: slug && slug !== wpSlugify(data.articleTitle) ? slug : null,
      ...(link && !item.writeForMe ? { targetUrl: link.targetUrl, anchorText: link.anchorText } : {}),
      ...(placed ? { updatePending: true } : {}),
    },
  });
  return { error: null, success: true };
}

// Admin's answer about an order; the customer's messages so far count as read.
export async function adminSendMessageAction(
  orderId: string,
  body: string
): Promise<{ error: string | null; success: boolean }> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") return { error: "Niet toegestaan.", success: false };
  const parsed = messageBodySchema.safeParse(body);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ongeldig bericht.", success: false };

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, orderNumber: true, customer: { select: { email: true } } },
  });
  if (!order) return { error: "Order niet gevonden.", success: false };

  await prisma.$transaction([
    prisma.orderMessage.create({ data: { orderId, fromAdmin: true, body: parsed.data } }),
    prisma.orderMessage.updateMany({
      where: { orderId, fromAdmin: false, readAt: null },
      data: { readAt: new Date() },
    }),
  ]);
  // The customer hears of it by mail, not only when they next log in.
  await sendNewMessageEmail(order.customer.email, order.orderNumber, order.id, parsed.data);
  return { error: null, success: true };
}

// Opening the order counts as reading the customer's messages.
export async function adminMarkMessagesReadAction(orderId: string): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") return;
  await prisma.orderMessage.updateMany({
    where: { orderId, fromAdmin: false, readAt: null },
    data: { readAt: new Date() },
  });
}

// Customers can't cancel (the platform only sells its own sites for now):
// the admin cancels a paid order here, which refunds it in full.
export async function adminCancelOrderAction(orderId: string): Promise<{ error: string | null; success: boolean }> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return { error: "Niet toegestaan.", success: false };
  }
  const { error } = await cancelAndRefundOrder(orderId);
  return { error, success: !error };
}

// "Preview naar klant": the saved article as a Word file (text only, no
// image), sent from the order mailbox as an answer in the customer's thread.
// Their reply comes back to this order (matched on the Message-ID).
export async function sendPreviewAction(orderItemId: string): Promise<{ error: string | null; message?: string }> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") return { error: "Niet toegestaan." };
  const item = await prisma.orderItem.findUnique({
    where: { id: String(orderItemId) },
    include: {
      order: { include: { customer: { include: { company: true } } } },
      websiteProduct: { include: { website: true } },
      inboundMails: { where: { isReply: false }, orderBy: { receivedAt: "asc" }, take: 1 },
      outboundMails: { orderBy: { sentAt: "asc" }, select: { messageId: true } },
      placement: { select: { id: true } },
    },
  });
  if (!item) return { error: "Order niet gevonden." };
  if (!item.articleTitle?.trim() || !item.articleBody?.replace(/<[^>]*>/g, "").trim()) {
    return { error: "Er is nog geen artikel om te versturen. Schrijf het en sla het op." };
  }
  if (item.placement) return { error: "Dit artikel staat al online." };

  const origin = item.inboundMails[0] ?? null;
  const to = origin?.fromEmail || item.order.customer.email;
  const company = item.order.customer.company?.name ?? item.order.customer.name;
  const domain = item.websiteProduct.website.domain;
  const version = item.previewVersion + 1;
  const date = new Date().toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Amsterdam",
  });
  const docx = await articleToDocx({
    title: item.articleTitle,
    html: item.articleBody,
    note: `Preview voor ${company} · plaatsing op ${domain} · versie ${version} · ${date}`,
  });
  const name = (origin?.fromName || item.order.customer.name || "").trim().split(/\s+/)[0] ?? "";
  const subject = origin
    ? `Re: ${origin.subject.replace(/^((re|fw|fwd|antw|doorst)\s*:\s*)+/i, "")}`
    : `Preview artikel voor ${domain}`;
  const settings = await prisma.siteSettings.findUnique({ where: { id: 1 } });
  const sender = emailSenderFrom(settings);
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const body = `<p>Hoi${name ? ` ${esc(name)}` : ""},</p>
<p>Hierbij de preview van het artikel voor <strong>${esc(domain)}</strong>${version > 1 ? ` (versie ${version})` : ""}. Je vindt het in de bijlage (Word).</p>
<p>Is het akkoord? Dan zetten we het online. Wil je iets anders? Antwoord gewoon op deze mail met je opmerkingen.</p>
<p>Groet,<br>${esc(sender.name || "Nugevonden")}</p>`;
  const html = emailLayout({ body, subject, to, sender, appUrl: process.env.NEXTAUTH_URL ?? "" });
  const text = `Hoi${name ? ` ${name}` : ""},\n\nHierbij de preview van het artikel voor ${domain}${version > 1 ? ` (versie ${version})` : ""}. Je vindt het in de bijlage (Word).\n\nIs het akkoord? Dan zetten we het online. Wil je iets anders? Antwoord gewoon op deze mail met je opmerkingen.\n\nGroet,\n${sender.name || "Nugevonden"}`;
  const safeTitle =
    item.articleTitle
      .replace(/[\\/:*?"<>|]+/g, "")
      .trim()
      .slice(0, 80) || "artikel";

  const sent = await sendFromMailbox({
    to,
    subject,
    html,
    text,
    fromName: sender.name || "Nugevonden",
    inReplyTo: origin?.messageId ?? item.outboundMails.at(-1)?.messageId ?? null,
    references: [...(origin ? [origin.messageId] : []), ...item.outboundMails.map((m) => m.messageId)],
    attachments: [
      {
        filename: `Preview - ${safeTitle}.docx`,
        content: docx,
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
    ],
  });
  if (!sent.ok) return { error: sent.message };
  await prisma.$transaction([
    prisma.outboundMail.create({
      data: { messageId: sent.messageId, orderItemId: item.id, toEmail: to, subject, version },
    }),
    prisma.orderItem.update({ where: { id: item.id }, data: { previewVersion: version, previewSentAt: new Date() } }),
  ]);
  revalidatePath("/admin", "layout");
  return { error: null, message: `Versie ${version} verstuurd aan ${to}.` };
}

// "Schrijfkosten weghalen": a mail order made with the writing fee while it
// should have been included. Only on account and not on a collective invoice
// yet, so an invoice that went out never changes.
export async function adminRemoveWritingFeeAction(orderItemId: string): Promise<{ error: string | null }> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") return { error: "Niet toegestaan." };
  const { count } = await prisma.orderItem.updateMany({
    where: {
      id: String(orderItemId),
      writeForMe: true,
      order: { onAccount: true, collectiveInvoiceId: null },
    },
    data: { writingFeeSnap: 0 },
  });
  if (count === 0) return { error: "Dit kan niet meer: de order staat al op een factuur." };
  revalidatePath("/admin", "layout");
  return { error: null };
}

// "Terug naar Binnengekomen": a mail order made by mistake (wrong site or
// customer) goes back to the mail it came from, to make it again. Only while
// nothing happened with it outside the platform: not online, not invoiced,
// not paid. Its mail is "Te doen" again; the order itself is removed.
export async function adminReturnToInboxAction(
  orderItemId: string
): Promise<{ error: string | null; mailId?: string }> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") return { error: "Niet toegestaan." };
  const item = await prisma.orderItem.findUnique({
    where: { id: String(orderItemId) },
    include: {
      placement: { select: { id: true } },
      inboundMails: { where: { isReply: false }, orderBy: { receivedAt: "asc" }, select: { id: true } },
      order: { include: { _count: { select: { items: true, invoices: true, payments: true } } } },
    },
  });
  if (!item) return { error: "Order niet gevonden." };
  const mail = item.inboundMails[0];
  if (!mail || !item.order.onAccount) return { error: "Deze order komt niet uit Binnengekomen." };
  if (item.placement) return { error: "Dit artikel staat al online." };
  if (item.order.collectiveInvoiceId || item.order._count.invoices > 0 || item.order._count.payments > 0) {
    return { error: "Dit kan niet meer: de order staat al op een factuur." };
  }
  await prisma.$transaction([
    prisma.inboundMail.updateMany({
      where: { orderItemId: item.id, isReply: false },
      data: { status: "new", orderItemId: null },
    }),
    item.order._count.items > 1
      ? prisma.orderItem.delete({ where: { id: item.id } })
      : prisma.order.delete({ where: { id: item.orderId } }),
  ]);
  revalidatePath("/admin", "layout");
  return { error: null, mailId: mail.id };
}

// "Website wijzigen": the wrong site chosen, before the article is online.
// A mail order that isn't invoiced yet gets the new site's price (as agreed
// with the customer); a paid order keeps what the customer paid.
export async function adminChangeWebsiteAction(
  orderItemId: string,
  websiteId: string
): Promise<{ error: string | null }> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") return { error: "Niet toegestaan." };
  const item = await prisma.orderItem.findUnique({
    where: { id: String(orderItemId) },
    include: {
      placement: { select: { id: true } },
      websiteProduct: { include: { product: true } },
      order: {
        include: { customer: { select: { companyId: true } }, _count: { select: { invoices: true } } },
      },
    },
  });
  if (!item) return { error: "Order niet gevonden." };
  if (item.placement) return { error: "Dit artikel staat al online." };
  if (["CANCELLED", "REJECTED", "REFUND_REQUESTED"].includes(item.order.status)) {
    return { error: "Deze order is geannuleerd." };
  }
  const target = await prisma.websiteProduct.findFirst({
    where: { websiteId: String(websiteId), product: { type: item.websiteProduct.product.type } },
  });
  if (!target) return { error: "Deze website heeft dit product niet." };
  if (target.id === item.websiteProductId) return { error: null };

  let price;
  try {
    price = await computePriceForWebsiteProduct(target.id, item.order.customer.companyId, item.topicId);
  } catch (err) {
    if (err instanceof TopicNotOfferedError) return { error: "Deze website plaatst dit onderwerp niet." };
    throw err;
  }
  const years = target.periodic ? item.durationYears : 1;
  const reprice = item.order.onAccount && !item.order.collectiveInvoiceId && item.order._count.invoices === 0;
  await prisma.orderItem.update({
    where: { id: item.id },
    data: {
      websiteProductId: target.id,
      periodic: target.periodic,
      durationYears: years,
      supplierPriceSnap: priceForYears(price.supplierPrice, years),
      marginSnap: price.marginPercent,
      ...(reprice ? { customerPriceSnap: priceForYears(price.customerPrice, years) } : {}),
      // The category belonged to the old site.
      wpTermId: null,
      wpCategoryNameSnap: null,
    },
  });
  revalidatePath("/admin", "layout");
  return { error: null };
}
