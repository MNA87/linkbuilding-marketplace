import { prisma } from "@/lib/prisma";
import { sendPlacementExpiringEmail } from "@/lib/email";
import { maybeAutoPublishOrder } from "@/lib/orderFulfillment";
import { REMINDER_DAYS_BEFORE, periodItemWhere } from "@/lib/placementPeriod";

const DAY_MS = 24 * 60 * 60 * 1000;

// One reminder per period, REMINDER_DAYS_BEFORE days before it ends. The
// claim (reminderSentAt) is set before sending, so two runs at once can
// never mail the same customer twice. A renewal clears it again.
export async function sendExpiryReminders(now = new Date()): Promise<number> {
  const due = await prisma.placement.findMany({
    where: {
      status: "published",
      reminderSentAt: null,
      orderItem: periodItemWhere,
      expiresAt: { gt: now, lte: new Date(now.getTime() + REMINDER_DAYS_BEFORE * DAY_MS) },
    },
    include: { orderItem: { include: { order: { include: { customer: true } }, websiteProduct: { include: { website: true } } } } },
  });

  let sent = 0;
  for (const placement of due) {
    const claimed = await prisma.placement.updateMany({
      where: { id: placement.id, reminderSentAt: null },
      data: { reminderSentAt: now },
    });
    if (claimed.count !== 1 || !placement.expiresAt || !placement.liveUrl) continue;

    await sendPlacementExpiringEmail(
      placement.orderItem.order.customer.email,
      placement.orderItem.websiteProduct.website.domain,
      placement.liveUrl,
      placement.expiresAt.toLocaleDateString("nl-NL", { timeZone: "Europe/Amsterdam" }),
      placement.orderItemId
    );
    sent++;
  }
  return sent;
}

// Sites synced by the plugin pick up a planned item themselves once its
// day has come (see /api/wp-sync/pending). A site published to directly
// through the WordPress API has no such poll — publish those from here.
export async function publishDuePlannedItems(now = new Date()): Promise<void> {
  const due = await prisma.orderItem.findMany({
    where: {
      publishAt: { lte: now },
      placement: { is: null },
      renewsOrderItemId: null,
      order: { status: { in: ["PAID", "SENT_TO_PUBLISHER", "ACCEPTED", "IN_PROGRESS"] } },
      websiteProduct: { website: { wpSyncSecret: null } },
    },
    select: { orderId: true },
    distinct: ["orderId"],
  });
  for (const { orderId } of due) {
    await maybeAutoPublishOrder(orderId);
  }
}

export async function runScheduledJobs(): Promise<void> {
  try {
    const sent = await sendExpiryReminders();
    if (sent > 0) console.log(`scheduled jobs: ${sent} verloopherinnering(en) verstuurd`);
  } catch (err) {
    console.error("scheduled jobs: verloopherinneringen mislukt", err);
  }
  try {
    await publishDuePlannedItems();
  } catch (err) {
    console.error("scheduled jobs: geplande plaatsingen publiceren mislukt", err);
  }
}
