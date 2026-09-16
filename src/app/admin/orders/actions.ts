"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { publishToWordPress, isWordPressConfigured } from "@/lib/wordpress";
import { z } from "zod";

const publishSchema = z.object({
  orderItemId: z.string().cuid(),
  liveUrl: z.string().trim().url("Vul een geldige URL in"),
});

const publishToWpSchema = z.object({
  orderItemId: z.string().cuid(),
});

// One-click publish for an already-paid order — the payment webhook only
// auto-publishes when the admin has switched that on globally (Admin ->
// Instellingen); this is the on-demand equivalent for a single order, e.g.
// after manually reviewing the content, or for a test order placed while
// auto-publish was off.
export async function adminPublishToWordPressAction(
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

  const orderItem = await prisma.orderItem.findUnique({
    where: { id: parsed.data.orderItemId },
    include: { order: true, websiteProduct: { include: { website: true } } },
  });
  if (!orderItem) return { error: "Niet toegestaan.", success: false };
  if (orderItem.order.status === "NEW") {
    return { error: "Deze order is nog niet betaald.", success: false };
  }

  const website = orderItem.websiteProduct.website;
  if (!isWordPressConfigured(website)) {
    return { error: "Deze site heeft geen WordPress-koppeling.", success: false };
  }
  if (!orderItem.articleTitle || !orderItem.articleBody) {
    return { error: "Geen content om te publiceren.", success: false };
  }

  try {
    const { liveUrl } = await publishToWordPress(website, {
      title: orderItem.articleTitle,
      body: orderItem.articleBody,
      targetUrl: orderItem.targetUrl,
      anchorText: orderItem.anchorText,
      imageKey: orderItem.articleImageKey,
    });

    await prisma.placement.upsert({
      where: { orderItemId: orderItem.id },
      create: { orderItemId: orderItem.id, liveUrl, publishedAt: new Date(), status: "published" },
      update: { liveUrl, publishedAt: new Date(), status: "published" },
    });

    const allItems = await prisma.orderItem.findMany({
      where: { orderId: orderItem.order.id },
      include: { placement: true },
    });
    if (allItems.every((i) => i.placement?.liveUrl)) {
      await prisma.order.update({ where: { id: orderItem.order.id }, data: { status: "PUBLISHED" } });
    }

    return { error: null, success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Publiceren mislukt.";
    return { error: message, success: false };
  }
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

  const allItems = await prisma.orderItem.findMany({
    where: { orderId: orderItem.order.id },
    include: { placement: true },
  });
  if (allItems.every((i) => i.placement?.liveUrl)) {
    await prisma.order.update({ where: { id: orderItem.order.id }, data: { status: "PUBLISHED" } });
  }

  return { error: null, success: true };
}
