import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { finalizeOrderIfFullyPublished } from "@/lib/orderFulfillment";

// Called by a site's own WordPress (see wordpress-plugin/nugevonden-wp-sync.php)
// at two different moments:
// 1. Right after it creates the post AS A DRAFT during sync — status:
//    "draft", no liveUrl yet. This just marks the item claimed so
//    /api/wp-sync/pending stops offering it on the next poll, without
//    claiming it's actually live. The admin reviews and publishes the
//    draft themselves, in WordPress, whenever they're ready.
// 2. From WordPress's own transition_post_status hook, the moment that
//    draft is actually published — real liveUrl this time. Once every
//    item in the order has one, flips the order to PUBLISHED. Mirrors
//    adminMarkPlacementPublishedAction's bookkeeping either way.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Ongeldige invoer" }, { status: 400 });
  }

  const { secret, orderItemId, liveUrl, status } = body as {
    secret?: string;
    orderItemId?: string;
    liveUrl?: string;
    status?: string;
  };
  const isDraft = status === "draft";
  if (!secret || !orderItemId || (!isDraft && !liveUrl)) {
    return NextResponse.json({ error: "secret, orderItemId en liveUrl zijn verplicht" }, { status: 400 });
  }

  const item = await prisma.orderItem.findUnique({
    where: { id: orderItemId },
    include: { websiteProduct: { include: { website: true } }, placement: true },
  });
  if (!item || !item.websiteProduct.website.wpSyncSecret || item.websiteProduct.website.wpSyncSecret !== secret) {
    return NextResponse.json({ error: "Niet toegestaan" }, { status: 403 });
  }

  // A draft-created notice arriving after the item is already live (a
  // retried request, or the post got unpublished and republished) must
  // never regress an already-recorded live URL back to a draft.
  if (isDraft && item.placement?.liveUrl) {
    return NextResponse.json({ ok: true });
  }

  // Diagnostic — pairs with the logging in /api/wp-sync/pending so a
  // wrong/stale item showing up live can be traced back to exactly which
  // orderItemId got acked and when.
  console.log(`wp-sync/ack: orderItemId=${item.id} status=${isDraft ? "draft" : "published"} liveUrl=${liveUrl ?? "-"}`);

  await prisma.placement.upsert({
    where: { orderItemId: item.id },
    create: {
      orderItemId: item.id,
      liveUrl: isDraft ? null : liveUrl,
      publishedAt: isDraft ? null : new Date(),
      status: isDraft ? "draft" : "published",
    },
    update: {
      liveUrl: isDraft ? null : liveUrl,
      publishedAt: isDraft ? null : new Date(),
      status: isDraft ? "draft" : "published",
    },
  });

  if (!isDraft) {
    await finalizeOrderIfFullyPublished(item.orderId);
  }

  return NextResponse.json({ ok: true });
}
