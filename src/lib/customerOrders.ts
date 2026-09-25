import type { OrderStatus } from "@prisma/client";
import { REMINDER_DAYS_BEFORE } from "@/lib/placementPeriod";

// "Mijn orders" lists every bought link (one row per order item) and puts
// each in one stage of its life: being handled, planned, live, about to
// expire, expired — or cancelled.
export type LinkStage = "behandeling" | "ingepland" | "live" | "verloopt" | "verlopen" | "geannuleerd";

export const LINK_TABS = [
  { key: "alle", label: "Alle" },
  { key: "behandeling", label: "In behandeling" },
  { key: "ingepland", label: "Ingepland" },
  { key: "live", label: "Live" },
  { key: "verloopt", label: "Verloopt binnenkort" },
  { key: "verlopen", label: "Verlopen" },
] as const;

export type LinkTab = (typeof LINK_TABS)[number]["key"];

export function parseTab(value: string | undefined): LinkTab {
  return LINK_TABS.some((t) => t.key === value) ? (value as LinkTab) : "alle";
}

// A link that is about to expire is still live, so it shows under "Live"
// as well as under "Verloopt binnenkort".
export function inTab(stage: LinkStage, tab: LinkTab): boolean {
  return tab === "alle" || stage === tab || (tab === "live" && stage === "verloopt");
}

// Colour of each stage's label.
export const STAGE_STYLES: Record<LinkStage, string> = {
  behandeling: "bg-blue-50 text-blue-700",
  ingepland: "bg-violet-50 text-violet-700",
  live: "bg-emerald-50 text-emerald-700",
  verloopt: "bg-amber-50 text-amber-700",
  verlopen: "bg-red-50 text-red-700",
  geannuleerd: "bg-gray-100 text-gray-600",
};

export type LinkStatusInput = {
  orderStatus: OrderStatus;
  publishAt: Date | null;
  writeForMe: boolean;
  articleBody: string | null;
  placement: { status: string; expiresAt: Date | null; expiredAt: Date | null } | null;
};

export type LinkStatus = { stage: LinkStage; label: string; detail: string };

const DAY_MS = 24 * 60 * 60 * 1000;
export const nlDate = (d: Date) => d.toLocaleDateString("nl-NL", { timeZone: "Europe/Amsterdam" });

export function linkStatus(item: LinkStatusInput, now = new Date()): LinkStatus {
  const p = item.placement;
  if (item.orderStatus === "CANCELLED" || item.orderStatus === "REJECTED") {
    return { stage: "geannuleerd", label: "Geannuleerd", detail: "" };
  }
  if (item.orderStatus === "REFUND_REQUESTED") {
    return { stage: "geannuleerd", label: "Annulering aangevraagd", detail: "Wordt beoordeeld" };
  }
  if (p?.status === "expired") {
    const on = p.expiredAt ?? p.expiresAt;
    return { stage: "verlopen", label: "Verlopen", detail: on ? `Verlopen op ${nlDate(on)}` : "Offline gehaald" };
  }
  if (p?.status === "published") {
    if (!p.expiresAt) return { stage: "live", label: "Live", detail: "Blijft online" };
    const soon = p.expiresAt.getTime() - now.getTime() <= REMINDER_DAYS_BEFORE * DAY_MS;
    return {
      stage: soon ? "verloopt" : "live",
      label: soon ? "Verloopt binnenkort" : "Live",
      detail: `Loopt tot ${nlDate(p.expiresAt)}`,
    };
  }
  if (item.publishAt && item.publishAt > now) {
    return { stage: "ingepland", label: "Ingepland", detail: `Online op ${nlDate(item.publishAt)}` };
  }
  const writing = item.writeForMe && !item.articleBody;
  return { stage: "behandeling", label: "In behandeling", detail: writing ? "Wordt geschreven" : "Wordt geplaatst" };
}

// "Alle": what needs attention first — links about to expire (soonest
// first), then the ones in progress, planned, live, expired, cancelled.
const STAGE_ORDER: LinkStage[] = ["verloopt", "behandeling", "ingepland", "live", "verlopen", "geannuleerd"];

export function sortLinks<T extends { stage: LinkStage; orderedAt: Date; expiresAt: Date | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const byStage = STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage);
    if (byStage !== 0) return byStage;
    if (a.stage === "verloopt" && a.expiresAt && b.expiresAt) return a.expiresAt.getTime() - b.expiresAt.getTime();
    return b.orderedAt.getTime() - a.orderedAt.getTime();
  });
}

// "https://www.site.nl/pagina/" → "site.nl/pagina", for compact display.
export function shortUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
}
