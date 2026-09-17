import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Called by a site's own WordPress once it has actually created the post
// (see wordpress-plugin/nugevonden-wp-sync.php) — records the live URL and,
// once every item in the order has one, flips the order to PUBLISHED.
// Mirrors adminMarkPlacementPublishedAction's bookkeeping, just triggered by
// the site itself instead of an admin pasting a URL.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Ongeldige invoer" }, { status: 400 });
  }

  const { secret, orderItemId, liveUrl } = body as { secret?: string; orderItemId?: string; liveUrl?: string };
  if (!secret || !orderItemId || !liveUrl) {
    return NextResponse.json({ error: "secret, orderItemId en liveUrl zijn verplicht" }, { status: 400 });
  }

  const item = await prisma.orderItem.findUnique({
    where: { id: orderItemId },
    include: { websiteProduct: { include: { website: true } } },
  });
  if (!item || !item.websiteProduct.website.wpSyncSecret || item.websiteProduct.website.wpSyncSecret !== secret) {
    return NextResponse.json({ error: "Niet toegestaan" }, { status: 403 });
  }

  // Diagnostic — pairs with the logging in /api/wp-sync/pending so a
  // wrong/stale item showing up live can be traced back to exactly which
  // orderItemId got acked and when.
  console.log(`wp-sync/ack: orderItemId=${item.id} liveUrl=${liveUrl}`);

  await prisma.placement.upsert({
    where: { orderItemId: item.id },
    create: { orderItemId: item.id, liveUrl, publishedAt: new Date(), status: "published" },
    update: { liveUrl, publishedAt: new Date(), status: "published" },
  });

  const allItems = await prisma.orderItem.findMany({
    where: { orderId: item.orderId },
    include: { placement: true },
  });
  if (allItems.every((i) => i.placement?.liveUrl)) {
    await prisma.order.update({ where: { id: item.orderId }, data: { status: "PUBLISHED" } });
  }

  return NextResponse.json({ ok: true });
}
