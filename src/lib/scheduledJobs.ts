import { prisma } from "@/lib/prisma";
import { deleteArticleImage } from "@/lib/upload";
import { sendContentReminderEmail, sendPlacementExpiringEmail } from "@/lib/email";
import { knowsPlatform } from "@/lib/onlineAccount";
import { jobFailed, jobOk } from "@/lib/systemAlerts";
import { awaitingContentWhere, contentReminderDue } from "@/lib/awaitingContent";
import { maybeAutoPublishOrder } from "@/lib/orderFulfillment";
import { REMINDER_DAYS_BEFORE, periodItemWhere } from "@/lib/placementPeriod";
import { refreshDueWebsiteMetrics } from "@/lib/websiteMetrics";
import { retryAllUnreachableVatChecks } from "@/lib/vatCheck";
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
    include: {
      orderItem: {
        include: { order: { include: { customer: true } }, websiteProduct: { include: { website: true } } },
      },
    },
  });

  let sent = 0;
  for (const placement of due) {
    const claimed = await prisma.placement.updateMany({
      where: { id: placement.id, reminderSentAt: null },
      data: { reminderSentAt: now },
    });
    if (claimed.count !== 1 || !placement.expiresAt || !placement.liveUrl) continue;
    if (!knowsPlatform(placement.orderItem.order.customer)) continue;

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
    if (!knowsPlatform(order.customer)) continue;
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

// A featured image is copied into the target site's own WordPress media
// library at publish time, so our stored copy is dead weight afterwards.
// We purge it a day after the placement went live — never sooner, because
// the plugin fetches the image from us right AFTER it confirms the
// placement (and again, in the same request, right after a change is
// acked), so an immediate purge would race that fetch. A whole day leaves
// that one-shot fetch long finished. The key stays in the database (the
// plugin compares it on later edits to tell whether the picture changed);
// only the bytes go. updatePending items are skipped — an edit in flight
// still re-fetches the image. A new image resets articleImagePurged, so it
// gets its own day before it too is purged.
const ARTICLE_IMAGE_PURGE_AFTER_MS = DAY_MS;

export async function purgePublishedArticleImages(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - ARTICLE_IMAGE_PURGE_AFTER_MS);
  const due = await prisma.orderItem.findMany({
    where: {
      articleImageKey: { not: null },
      articleImagePurged: false,
      updatePending: false,
      placement: { is: { status: "published", publishedAt: { lte: cutoff } } },
    },
    select: { id: true, articleImageKey: true },
  });

  let purged = 0;
  for (const item of due) {
    if (!item.articleImageKey) continue;
    try {
      // Delete the bytes first; only then record it, so a failed delete is
      // simply retried next run (deleting an already-gone key is a no-op)
      // rather than leaving the flag set on a file that's still there.
      await deleteArticleImage(item.articleImageKey);
      await prisma.orderItem.update({ where: { id: item.id }, data: { articleImagePurged: true } });
      purged++;
    } catch (err) {
      console.error(`scheduled jobs: afbeelding opruimen mislukt voor orderItem ${item.id}`, err);
    }
  }
  return purged;
}

export async function runScheduledJobs(): Promise<void> {
  // First, so a problem in another job never costs us a backup.
  await runHourlyBackup().catch((err) => console.error("scheduled jobs: back-up mislukt", err));
  try {
    const sent = await sendExpiryReminders();
    if (sent > 0) console.log(`scheduled jobs: ${sent} verloopherinnering(en) verstuurd`);
    await jobOk("Verloopherinneringen");
  } catch (err) {
    await jobFailed("Verloopherinneringen", err);
  }
  try {
    const sent = await sendContentReminders();
    if (sent > 0) console.log(`scheduled jobs: ${sent} herinnering(en) om inhoud aan te leveren verstuurd`);
    await jobOk("Herinneringen inhoud aanleveren");
  } catch (err) {
    await jobFailed("Herinneringen inhoud aanleveren", err);
  }
  try {
    const checked = await retryAllUnreachableVatChecks();
    if (checked > 0) console.log(`scheduled jobs: ${checked} btw-nummer(s) alsnog gecontroleerd`);
    await jobOk("Btw-nummers controleren");
  } catch (err) {
    await jobFailed("Btw-nummers controleren", err);
  }
  try {
    await publishDuePlannedItems();
    await jobOk("Geplande plaatsingen publiceren");
  } catch (err) {
    await jobFailed("Geplande plaatsingen publiceren", err);
  }
  try {
    const refreshed = await refreshDueWebsiteMetrics();
    if (refreshed > 0) console.log(`scheduled jobs: cijfers van ${refreshed} website(s) bijgewerkt`);
    await jobOk("Websitecijfers bijwerken");
  } catch (err) {
    await jobFailed("Websitecijfers bijwerken", err);
  }
  try {
    const purged = await purgePublishedArticleImages();
    if (purged > 0) console.log(`scheduled jobs: ${purged} gepubliceerde afbeelding(en) opgeruimd`);
    await jobOk("Afbeeldingen opruimen");
  } catch (err) {
    await jobFailed("Afbeeldingen opruimen", err);
  }
}
