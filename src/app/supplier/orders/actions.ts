"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const publishSchema = z.object({
  orderItemId: z.string().cuid(),
  liveUrl: z.string().trim().url("Vul een geldige URL in"),
});

export async function markPlacementPublishedAction(
  input: unknown
): Promise<{ error: string | null; success: boolean }> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "supplier" || !session.user.companyId) {
    return { error: "Niet toegestaan.", success: false };
  }

  const parsed = publishSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer", success: false };
  }

  const orderItem = await prisma.orderItem.findUnique({
    where: { id: parsed.data.orderItemId },
    include: { websiteProduct: { include: { website: true } }, order: true },
  });
  if (!orderItem || orderItem.websiteProduct.website.companyId !== session.user.companyId) {
    return { error: "Niet toegestaan.", success: false };
  }
  if (orderItem.order.status === "NEW") {
    return { error: "Deze order is nog niet betaald.", success: false };
  }

  await prisma.$transaction([
    prisma.placement.upsert({
      where: { orderItemId: orderItem.id },
      create: {
        orderItemId: orderItem.id,
        liveUrl: parsed.data.liveUrl,
        publishedAt: new Date(),
        status: "published",
      },
      update: {
        liveUrl: parsed.data.liveUrl,
        publishedAt: new Date(),
        status: "published",
      },
    }),
    prisma.order.update({ where: { id: orderItem.order.id }, data: { status: "PUBLISHED" } }),
  ]);

  return { error: null, success: true };
}
