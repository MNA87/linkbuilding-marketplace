import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildContentWithLink } from "@/lib/wordpress";

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

  const items = await prisma.orderItem.findMany({
    where: {
      readyToPublish: true,
      websiteProduct: { websiteId: website.id },
      placement: { is: null },
    },
  });

  const baseUrl = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");

  // Diagnostic — a2f.nl saw a post land with no image and the wrong
  // category despite both being set on the order; this pins down whether
  // that data ever leaves this endpoint in the first place.
  console.log(
    `wp-sync/pending for ${website.domain}: ${items.length} item(s) — ${items
      .map((i) => `${i.id}(cat=${i.wpTermId ?? "none"},img=${i.articleImageKey ? "yes" : "no"})`)
      .join(", ")}`
  );

  return NextResponse.json({
    items: items.map((item) => ({
      id: item.id,
      title: item.articleTitle ?? "",
      content: buildContentWithLink(item.articleBody ?? "", item.targetUrl, item.anchorText),
      categoryId: item.wpTermId,
      imageUrl: item.articleImageKey
        ? `${baseUrl}/api/wp-sync/image/${item.id}?secret=${encodeURIComponent(secret)}`
        : null,
    })),
  });
}
