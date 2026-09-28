import { prisma } from "@/lib/prisma";
import { sendOrderPublishedEmail } from "@/lib/email";

// The links of one order that go live together (in one sync of the site's
// plugin) share one "staat live" mail; a link that follows later — e.g. on
// the day the customer chose — gets a mail of its own then. Waiting a
// little after the last link went live lets a round finish first.
export const LIVE_MAIL_WAIT_MS = 90_000;

const CLOSED = ["NEW", "CANCELLED", "REJECTED", "REFUND_REQUESTED"] as const;

const nlDay = (d: Date) =>
  d.toLocaleDateString("nl-NL", { day: "numeric", month: "long", timeZone: "Europe/Amsterdam" });

// "Nog te gaan": the order's links that aren't live yet, for the mail.
export function stillToCome(
  items: { domain: string; publishAt: Date | null }[],
  now = new Date()
): string[] {
  return items.map((i) =>
    i.publishAt && i.publishAt > now ? `${i.domain} komt online op ${nlDay(i.publishAt)}` : `${i.domain} volgt binnenkort`
  );
}

export async function sendLiveMails(now = new Date()): Promise<number> {
  const waiting = await prisma.placement.findMany({
    where: {
      status: "published",
      liveUrl: { not: null },
      liveMailSentAt: null,
      orderItem: { renewsOrderItemId: null, order: { status: { notIn: [...CLOSED] } } },
    },
    include: { orderItem: { include: { websiteProduct: { include: { website: true } } } } },
  });

  const byOrder = new Map<string, typeof waiting>();
  for (const p of waiting) byOrder.set(p.orderItem.orderId, [...(byOrder.get(p.orderItem.orderId) ?? []), p]);

  let sent = 0;
  for (const [orderId, placements] of Array.from(byOrder)) {
    // Still going live, one after another: wait for the round to finish.
    if (placements.some((p) => p.publishedAt && now.getTime() - p.publishedAt.getTime() < LIVE_MAIL_WAIT_MS)) continue;

    const claimed = await prisma.placement.updateMany({
      where: { id: { in: placements.map((p) => p.id) }, liveMailSentAt: null },
      data: { liveMailSentAt: now },
    });
    if (claimed.count === 0) continue;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        items: { include: { placement: true, websiteProduct: { include: { website: true } } } },
      },
    });
    if (!order) continue;
    const notYet = order.items.filter((i) => !i.renewsOrderItemId && !i.placement?.liveUrl);

    await sendOrderPublishedEmail(
      order.customer.email,
      order.id,
      placements.map((p) => ({ domain: p.orderItem.websiteProduct.website.domain, liveUrl: p.liveUrl! })),
      stillToCome(
        notYet.map((i) => ({ domain: i.websiteProduct.website.domain, publishAt: i.publishAt })),
        now
      )
    );
    sent++;
  }
  return sent;
}
