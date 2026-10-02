import type { OrderStatus } from "@prisma/client";

// What happens next with a paid link, seen from the admin: is it waiting
// on us (write, publish, finish the WordPress draft) or on something else
// (the customer, the planned day, the site picking it up)?
export type NextStep = { label: string; yours: boolean } | null;

const CLOSED: OrderStatus[] = ["NEW", "CANCELLED", "REJECTED", "REFUND_REQUESTED"];

export function adminNextStep(item: {
  orderStatus: OrderStatus;
  isRenewal: boolean;
  placementStatus: string | null;
  liveUrl: string | null;
  awaitingContent: boolean;
  writeForMe: boolean;
  hasArticle: boolean;
  readyToPublish: boolean;
  publishAt: Date | null;
  // A Word preview went to the customer: their answer comes first.
  previewSent?: boolean;
  now?: Date;
}): NextStep {
  if (CLOSED.includes(item.orderStatus) || item.isRenewal) return null;
  if (item.liveUrl || item.placementStatus === "expired") return null;
  if (item.placementStatus === "draft") return { label: "Concept publiceren", yours: true };
  if (item.awaitingContent) return { label: "Wacht op klant", yours: false };
  if (item.writeForMe && !item.hasArticle) return { label: "Artikel schrijven", yours: true };
  if (item.readyToPublish) {
    const now = item.now ?? new Date();
    if (item.publishAt && item.publishAt > now) {
      const day = item.publishAt.toLocaleDateString("nl-NL", { day: "numeric", month: "short", timeZone: "Europe/Amsterdam" });
      return { label: `Gepland ${day}`, yours: false };
    }
    return { label: "Wordt geplaatst", yours: false };
  }
  if (item.previewSent) return { label: "Wacht op akkoord klant", yours: false };
  return { label: "Publiceren", yours: true };
}
