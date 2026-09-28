import type { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { placementDetails } from "@/lib/placementPeriod";
import { TEST_CUSTOMER_EMAIL } from "@/lib/testCustomer";
import { isAwaitingContent } from "@/lib/awaitingContent";
import { adminNextStep, type NextStep } from "@/lib/adminNextStep";
import { linkStatus, type LinkStage, type LinkStatus } from "@/lib/customerOrders";
import { hasPeriod } from "@/lib/placementPeriod";

export type AdminOrderRow = {
  id: string;
  isTest: boolean;
  orderId: string;
  orderNumber: number;
  orderStatus: OrderStatus;
  orderedAt: Date;
  customer: string;
  domain: string;
  details: string;
  liveUrl: string | null;
  // Where the link stands, the same words the customer sees.
  stage: LinkStage;
  stageLabel: string;
  next: NextStep;
};

// Admin → Orders: one row per link, newest first. "actief" is everything
// paid that isn't archived; "archief" what was put away.
export async function adminOrderRows(view: "actief" | "archief"): Promise<AdminOrderRow[]> {
  const items = await prisma.orderItem.findMany({
    where: {
      order: view === "archief" ? { archivedAt: { not: null } } : { archivedAt: null, status: { not: "NEW" } },
    },
    include: {
      order: { include: { customer: { include: { company: true } } } },
      websiteProduct: { include: { website: true, product: true } },
      placement: true,
    },
    orderBy: { id: "asc" },
  });
  const now = new Date();
  const rows = items.map((item) => {
    const awaitingContent = isAwaitingContent(item, item.order.status, item.websiteProduct.product.type);
    const status = adminLinkStatus(
      item.renewsOrderItemId,
      linkStatus(
        {
          ...item,
          orderStatus: item.order.status,
          periodic: hasPeriod(item.websiteProduct.product.type),
          needsContent: awaitingContent,
        },
        now
      )
    );
    return {
      id: item.id,
      isTest: item.order.customer.email === TEST_CUSTOMER_EMAIL,
      orderId: item.order.id,
      orderNumber: item.order.orderNumber,
      orderStatus: item.order.status,
      orderedAt: item.order.paidAt ?? item.order.createdAt,
      customer: item.order.customer.company?.name ?? item.order.customer.name,
      domain: item.websiteProduct.website.domain,
      details: placementDetails(item),
      liveUrl: item.placement?.liveUrl ?? null,
      stage: status.stage,
      stageLabel: status.label,
      next: adminNextStep({
        orderStatus: item.order.status,
        isRenewal: Boolean(item.renewsOrderItemId),
        placementStatus: item.placement?.status ?? null,
        liveUrl: item.placement?.liveUrl ?? null,
        // Paid before the customer filled it in ("Nu betalen, later aanleveren").
        awaitingContent,
        writeForMe: item.writeForMe,
        hasArticle: Boolean(item.articleTitle && item.articleBody),
        readyToPublish: item.readyToPublish,
        publishAt: item.publishAt,
      }),
    };
  });
  // Newest first by the date shown (paid, or else created).
  return rows.sort((a, b) => b.orderedAt.getTime() - a.orderedAt.getTime() || a.orderNumber - b.orderNumber);
}

// The links waiting on us (write, publish, finish a draft): the number on
// Orders in the admin menu.
export async function adminActionCount(): Promise<number> {
  return (await adminOrderRows("actief")).filter((r) => r.next?.yours).length;
}

// The customer's words for where a link stands, as the admin reads them: a
// renewal places nothing of its own, and "waiting for your content" is the
// customer's to do.
export function adminLinkStatus(renewsOrderItemId: string | null, status: LinkStatus): LinkStatus {
  if (renewsOrderItemId && status.stage !== "geannuleerd") return { stage: "live", label: "Verlenging", detail: "" };
  if (status.stage === "wacht") return { ...status, label: "Wacht op klant" };
  return status;
}
