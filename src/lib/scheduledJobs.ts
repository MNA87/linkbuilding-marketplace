import { prisma } from "@/lib/prisma";
import { sendContentReminderEmail, sendPlacementExpiringEmail } from "@/lib/email";
import { awaitingContentWhere, contentReminderDue } from "@/lib/awaitingContent";
import { maybeAutoPublishOrder } from "@/lib/orderFulfillment";
import { REMINDER_DAYS_BEFORE, periodItemWhere } from "@/lib/placementPeriod";
import { refreshDueWebsiteMetrics } from "@/lib/websiteMetrics";
import { runHourlyBackup } from "@/lib/databaseBackup";

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

// "Nu betalen, later aanleveren": one mail per order, 3, 7 and 30 days
// after payment, while any of its links still wait for content. Each item
// counts its own reminders; the claim (raising the count from what was
// read) comes before sending, so two runs at once never mail twice.
export async function sendContentReminders(now = new Date()): Promise<number> {
  const waiting = await prisma.orderItem.findMany({
    where: awaitingContentWhere(),
    include: { order: { include: { customer: true } }, websiteProduct: { include: { website: true } } },
    orderBy: { id: "asc" },
  });
  const byOrder = new Map<string, typeof waiting>();
  for (const item of waiting) byOrder.set(item.orderId, [...(byOrder.get(item.orderId) ?? []), item]);

  let sent = 0;
  for (const items of Array.from(byOrder.values())) {
    const order = items[0].order;
    const count = Math.min(...items.map((i) => i.contentReminderCount));
    if (!order.paidAt || !contentReminderDue(order.paidAt, count, now)) continue;
    const claimed = await prisma.orderItem.updateMany({
      where: { id: { in: items.map((i) => i.id) }, contentReminderCount: count },
      data: { contentReminderCount: count + 1 },
    });
    if (claimed.count === 0) continue;
    const first = items[0];
    const fillPath =
      `/marketplace/${first.websiteProductId}?orderItemId=${first.id}` +
      (items.length > 1 ? `&stap=1&van=${items.length}` : "");
    await sendContentReminderEmail(
      order.customer.email,
      order.orderNumber,
      items.map((i) => i.websiteProduct.website.domain),
      fillPath
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
  // First, so a problem in another job never costs us a backup.
  await runHourlyBackup().catch((err) => console.error("scheduled jobs: back-up mislukt", err));
  try {
    const sent = await sendExpiryReminders();
    if (sent > 0) console.log(`scheduled jobs: ${sent} verloopherinnering(en) verstuurd`);
  } catch (err) {
    console.error("scheduled jobs: verloopherinneringen mislukt", err);
  }
  try {
    const sent = await sendContentReminders();
    if (sent > 0) console.log(`scheduled jobs: ${sent} herinnering(en) om inhoud aan te leveren verstuurd`);
  } catch (err) {
    console.error("scheduled jobs: herinneringen inhoud aanleveren mislukt", err);
  }
  try {
    await publishDuePlannedItems();
  } catch (err) {
    console.error("scheduled jobs: geplande plaatsingen publiceren mislukt", err);
  }
  try {
    const refreshed = await refreshDueWebsiteMetrics();
    if (refreshed > 0) console.log(`scheduled jobs: cijfers van ${refreshed} website(s) bijgewerkt`);
  } catch (err) {
    console.error("scheduled jobs: websitecijfers bijwerken mislukt", err);
  }
}
