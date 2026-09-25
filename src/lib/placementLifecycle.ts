import { prisma } from "@/lib/prisma";
import { addYears, hasPeriod } from "@/lib/placementPeriod";

// The paid period starts the moment a placement actually goes live: sets
// expiresAt = publishedAt + durationYears, once. Called from every place
// that marks a placement published (WP sync ack, admin, supplier, direct
// publish); a republish later never moves an end date that's already set.
export async function startPlacementPeriod(orderItemId: string): Promise<void> {
  const item = await prisma.orderItem.findUnique({
    where: { id: orderItemId },
    include: { placement: true, websiteProduct: { include: { product: true } } },
  });
  const placement = item?.placement;
  if (!item || !placement?.liveUrl || placement.expiresAt) return;
  // A blog article stays online for good: no end date.
  if (!hasPeriod(item.websiteProduct.product.type)) return;

  await prisma.placement.update({
    where: { id: placement.id },
    data: { expiresAt: addYears(placement.publishedAt ?? new Date(), item.durationYears) },
  });
}
