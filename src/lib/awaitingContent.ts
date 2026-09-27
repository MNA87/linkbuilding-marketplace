import { Prisma, type OrderStatus } from "@prisma/client";
import { itemNeedsContent } from "@/lib/writingService";

// "Nu betalen, later aanleveren": an item can be paid for before its
// content is filled in. Until the customer sends it in, it waits — nothing
// is queued or published for it (maybeAutoPublishOrder only picks up items
// with content) — and it shows as "Wacht op jouw inhoud".

// A paid order that's still going: its items can still be filled in.
export const AWAITING_ORDER_STATUSES: OrderStatus[] = ["PAID", "SENT_TO_PUBLISHER", "ACCEPTED", "IN_PROGRESS"];

// Reminders to fill it in, this many days after payment (one each).
export const CONTENT_REMINDER_DAYS = [3, 7, 30];

const DAY_MS = 24 * 60 * 60 * 1000;

// The database side of itemNeedsContent: a homepage link without its URL,
// "Laat ons schrijven" without its links, an own article without its title.
export const missingContentWhere: Prisma.OrderItemWhereInput = {
  OR: [
    { websiteProduct: { product: { type: "HOMEPAGE_LINK" } }, targetUrl: null },
    { websiteProduct: { product: { type: { not: "HOMEPAGE_LINK" } } }, writeForMe: true, briefLinks: { equals: Prisma.AnyNull } },
    { websiteProduct: { product: { type: { not: "HOMEPAGE_LINK" } } }, writeForMe: false, articleTitle: null },
  ],
};

// Paid items (of one customer, or everyone's) still waiting for content.
export function awaitingContentWhere(customerId?: string): Prisma.OrderItemWhereInput {
  return {
    renewsOrderItemId: null,
    placement: { is: null },
    order: { status: { in: AWAITING_ORDER_STATUSES }, ...(customerId ? { customerId } : {}) },
    ...missingContentWhere,
  };
}

export function isAwaitingContent(
  item: Parameters<typeof itemNeedsContent>[0] & { placement?: unknown },
  orderStatus: OrderStatus,
  productType: string
): boolean {
  return AWAITING_ORDER_STATUSES.includes(orderStatus) && !item.placement && itemNeedsContent(item, productType);
}

// The next reminder is due once its number of days since payment has
// passed; after the last one there are no more.
export function contentReminderDue(paidAt: Date, sentSoFar: number, now = new Date()): boolean {
  const days = CONTENT_REMINDER_DAYS[sentSoFar];
  return days !== undefined && now.getTime() - paidAt.getTime() >= days * DAY_MS;
}
