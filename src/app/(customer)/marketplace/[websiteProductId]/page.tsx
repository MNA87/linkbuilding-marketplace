import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import OrderPanel from "./OrderPanel";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ websiteProductId: string }>;
}): Promise<Metadata> {
  const { websiteProductId } = await params;
  const websiteProduct = await prisma.websiteProduct.findUnique({
    where: { id: websiteProductId },
    select: { website: { select: { domain: true } } },
  });
  return { title: websiteProduct ? `Bestellen: ${websiteProduct.website.domain}` : "Bestellen" };
}

// The full-page order screen. The same screen also opens as a popup over the
// marketplace via the intercepting route in @modal — both render OrderPanel.
export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ websiteProductId: string }>;
  searchParams: Promise<{ orderItemId?: string; nieuw?: string; stap?: string; van?: string }>;
}) {
  const { websiteProductId } = await params;
  const { orderItemId, nieuw, stap, van } = await searchParams;
  return (
    <OrderPanel websiteProductId={websiteProductId} orderItemId={orderItemId} nieuw={nieuw} stap={stap} van={van} />
  );
}
