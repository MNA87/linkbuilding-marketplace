import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildContentWithLink } from "@/lib/wordpress";
import { wpSlugify } from "@/lib/wpSlug";

// Called BY a site's own WordPress install (see wordpress-plugin/nugevonden-wp-sync.php),
// polling from itself rather than us pushing to it — the direction that
// dodges inbound bot protection like SiteGround's AI Anti-Bot Protection,
// which turned out to block any unrecognized inbound POST regardless of
// path. Authenticated with the site's own wpSyncSecret, not a session.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");
  if (!secret) {
    return NextResponse.json({ error: "secret ontbreekt" }, { status: 400 });
  }

  const website = await prisma.website.findUnique({ where: { wpSyncSecret: secret } });
  if (!website) {
    return NextResponse.json({ error: "Ongeldige sleutel" }, { status: 403 });
  }

  const now = new Date();
  const items = await prisma.orderItem.findMany({
    where: {
      readyToPublish: true,
      websiteProduct: { websiteId: website.id },
      placement: { is: null },
      // "Wanneer online?": a planned item stays here until its day.
      OR: [{ publishAt: null }, { publishAt: { lte: now } }],
    },
    include: { websiteProduct: { include: { product: true } } },
  });

  // Placements whose paid period is over: the site takes them offline and
  // acks with status "expired" (see nugevonden_sync_expire() in the plugin).
  const expiring = await prisma.placement.findMany({
    where: {
      status: "published",
      expiresAt: { lte: now },
      expiredAt: null,
      orderItem: { websiteProduct: { websiteId: website.id } },
    },
    include: { orderItem: { include: { websiteProduct: { include: { product: true } } } } },
  });

  const baseUrl = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");

  // Diagnostic — a2f.nl saw a post land with no image and the wrong
  // category despite both being set on the order; this pins down whether
  // that data ever leaves this endpoint in the first place.
  // Queued for this site but not handed out (planned for later, or already
  // placed) — so a "why is this still waiting?" can be read from the logs.
  const heldBack = await prisma.orderItem.findMany({
    where: {
      readyToPublish: true,
      websiteProduct: { websiteId: website.id },
      id: { notIn: items.map((i) => i.id) },
    },
    select: { id: true, publishAt: true, placement: { select: { status: true } } },
  });
  console.log(
    `wp-sync/pending for ${website.domain} (${website.id}): ${items.length} item(s) — ${items
      .map((i) => `${i.id}(cat=${i.wpTermId ?? "none"},img=${i.articleImageKey ? "yes" : "no"})`)
      .join(", ")}${
      heldBack.length
        ? ` | held back: ${heldBack
            .map((i) => `${i.id}(${i.placement ? `placement=${i.placement.status}` : `publishAt=${i.publishAt?.toISOString()}`})`)
            .join(", ")}`
        : ""
    }`
  );

  return NextResponse.json({
    expire: expiring.map((p) => ({
      id: p.orderItemId,
      type: p.orderItem.websiteProduct.product.type === "HOMEPAGE_LINK" ? "homepage_link" : "blog_post",
      liveUrl: p.liveUrl,
      targetUrl: p.orderItem.targetUrl,
    })),
    items: items.map((item) =>
      // A homepage-link (ProductType.HOMEPAGE_LINK, see the startpagina
      // feature) isn't an article — just a category, anchor text and a
      // target URL, published immediately with no draft/review step. See
      // nugevonden_sync_homepage_link() in the plugin.
      item.websiteProduct.product.type === "HOMEPAGE_LINK"
        ? {
            id: item.id,
            type: "homepage_link",
            anchorText: item.anchorText ?? "",
            targetUrl: item.targetUrl ?? "",
            nofollow: item.nofollow,
            categoryId: item.wpTermId,
          }
        : {
            id: item.id,
            type: "blog_post",
            title: item.articleTitle ?? "",
            // Same slug the order form previewed as "URL na plaatsing".
            slug: wpSlugify(item.articleTitle ?? ""),
            content: buildContentWithLink(item.articleBody ?? "", item.targetUrl, item.anchorText, item.nofollow),
            categoryId: item.wpTermId,
            imageUrl: item.articleImageKey
              ? `${baseUrl}/api/wp-sync/image/${item.id}?secret=${encodeURIComponent(secret)}`
              : null,
          }
    ),
  });
}
