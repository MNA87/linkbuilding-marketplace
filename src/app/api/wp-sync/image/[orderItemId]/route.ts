import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getArticleImageBuffer } from "@/lib/upload";

// A site's own WordPress fetches this as a plain remote image URL (via
// media_sideload_image()) while syncing a pending order — see
// src/app/api/wp-sync/pending and wordpress-plugin/nugevonden-wp-sync.php.
export async function GET(req: Request, { params }: { params: Promise<{ orderItemId: string }> }) {
  const { orderItemId } = await params;
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");
  if (!secret) {
    return NextResponse.json({ error: "secret ontbreekt" }, { status: 400 });
  }

  const item = await prisma.orderItem.findUnique({
    where: { id: orderItemId },
    include: { websiteProduct: { include: { website: true } } },
  });
  if (!item || !item.websiteProduct.website.wpSyncSecret || item.websiteProduct.website.wpSyncSecret !== secret) {
    return NextResponse.json({ error: "Niet toegestaan" }, { status: 403 });
  }
  if (!item.articleImageKey) {
    return NextResponse.json({ error: "Geen afbeelding" }, { status: 404 });
  }

  const { buffer, contentType } = await getArticleImageBuffer(item.articleImageKey);
  return new NextResponse(new Uint8Array(buffer), { headers: { "Content-Type": contentType } });
}
