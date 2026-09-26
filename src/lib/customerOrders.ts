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

export const STAGE_DOTS: Record<LinkStage, string> = {
  behandeling: "bg-blue-600",
  ingepland: "bg-violet-600",
  live: "bg-emerald-600",
  verloopt: "bg-amber-600",
  verlopen: "bg-red-600",
  geannuleerd: "bg-gray-500",
};

export type LinkStatusInput = {
  orderStatus: OrderStatus;
  // Bought for a period (homepage link) — or for good (blog article).
  periodic: boolean;
  publishAt: Date | null;
  writeForMe: boolean;
  articleBody: string | null;
  placement: { status: string; publishedAt?: Date | null; expiresAt: Date | null; expiredAt: Date | null } | null;
};

export type LinkStatus = { stage: LinkStage; label: string; detail: string };

const DAY_MS = 24 * 60 * 60 * 1000;
export const nlDate = (d: Date) => d.toLocaleDateString("nl-NL", { timeZone: "Europe/Amsterdam" });
// "30-9-2026 om 08:00"
export const nlDateTime = (d: Date) =>
  `${nlDate(d)} om ${d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam" })}`;

// The opening words of an article, as plain text, for a short preview.
export function articleExcerpt(html: string, maxLength = 220): string {
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength).replace(/\s+\S*$/, "")}…` : text;
}

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
    if (!item.periodic || !p.expiresAt) {
      return { stage: "live", label: "Live", detail: p.publishedAt ? `Online sinds ${nlDate(p.publishedAt)}` : "Online" };
    }
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

export const ORDER_SORTS = [
  { value: "nieuw", label: "Nieuwste eerst" },
  { value: "oud", label: "Oudste eerst" },
  { value: "website", label: "Website A-Z" },
  { value: "status", label: "Status" },
] as const;

export type OrderSort = (typeof ORDER_SORTS)[number]["value"];

export function parseOrderSort(value: string | undefined): OrderSort {
  return ORDER_SORTS.some((s) => s.value === value) ? (value as OrderSort) : "nieuw";
}

// Status order for sorting: what needs attention first.
const STAGE_ORDER: LinkStage[] = ["verloopt", "behandeling", "ingepland", "live", "verlopen", "geannuleerd"];

// By order number (newest or oldest first), website or status — newest
// first within those; links from the same order in a fixed order.
export function sortLinks<T extends { id: string; orderNumber: number; domain: string; stage: LinkStage }>(
  rows: T[],
  sort: OrderSort = "nieuw"
): T[] {
  const newest = (a: T, b: T) => b.orderNumber - a.orderNumber || a.id.localeCompare(b.id);
  return [...rows].sort((a, b) => {
    if (sort === "oud") return -newest(a, b);
    if (sort === "website") return a.domain.localeCompare(b.domain) || newest(a, b);
    if (sort === "status") return STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage) || newest(a, b);
    return newest(a, b);
  });
}

// "Zoek op website, ordernummer of ankertekst" — "57" and "#57" both find
// order 57.
export function matchesSearch(row: { domain: string; orderNumber: number; anchors: string[] }, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (/^#?\d+$/.test(q) && String(row.orderNumber) === q.replace("#", "")) return true;
  return row.domain.toLowerCase().includes(q) || row.anchors.some((a) => a.toLowerCase().includes(q));
}

// "https://www.site.nl/pagina/" → "site.nl/pagina", for compact display.
export function shortUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
}
