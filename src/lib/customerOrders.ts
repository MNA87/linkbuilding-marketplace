import type { OrderStatus } from "@prisma/client";
import { REMINDER_DAYS_BEFORE } from "@/lib/placementPeriod";

// "Mijn orders" lists every bought link (one row per order item) and puts
// each in one stage of its life: waiting for the customer's content (paid
// before it was filled in), being handled, planned, live, about to expire,
// expired — or cancelled.
export type LinkStage = "wacht" | "behandeling" | "ingepland" | "live" | "verloopt" | "verlopen" | "geannuleerd";

export const LINK_TABS = [
  { key: "alle", label: "Alle" },
  { key: "wacht", label: "Wacht op jou" },
  { key: "behandeling", label: "In behandeling" },
  { key: "ingepland", label: "Ingepland" },
  { key: "live", label: "Live" },
  { key: "verloopt", label: "Verloopt binnenkort" },
  { key: "verlopen", label: "Verlopen" },
  { key: "geannuleerd", label: "Geannuleerd" },
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

// De negen statussen samengevat in vier begrijpelijke groepen voor het
// segment-filter in Mijn orders. "Verloopt binnenkort" valt onder Live (het
// is nog een live link). Het fijnmazige onderscheid blijft zichtbaar op de
// status-badge per rij.
export const STATUS_GROUPS = [
  { key: "lopend", label: "Lopend" },
  { key: "live", label: "Live" },
  { key: "alle", label: "Alle" },
] as const;

export type StatusGroup = (typeof STATUS_GROUPS)[number]["key"];

const GROUP_STAGES: Record<Exclude<StatusGroup, "alle">, LinkStage[]> = {
  lopend: ["wacht", "behandeling", "ingepland"],
  live: ["live", "verloopt"],
};

// Begrijpt ook de oude, fijnmazige tab-waarden (bestaande deep-links en de
// dashboard-knoppen) en mapt die naar hun groep. Afgehandelde orders
// (verlopen/geannuleerd) hebben geen eigen tab meer en vallen onder "Alle".
export function parseGroup(value: string | undefined): StatusGroup {
  if (!value || value === "alle") return "alle";
  if (STATUS_GROUPS.some((g) => g.key === value)) return value as StatusGroup;
  const legacy: Record<string, StatusGroup> = {
    wacht: "lopend",
    behandeling: "lopend",
    ingepland: "lopend",
    live: "live",
    verloopt: "live",
    verlopen: "alle",
    geannuleerd: "alle",
  };
  return legacy[value] ?? "alle";
}

export function inGroup(stage: LinkStage, group: StatusGroup): boolean {
  return group === "alle" || GROUP_STAGES[group].includes(stage);
}

// Status als zachte, maar duidelijk zichtbare tint-pill — in de rustige
// tint-familie van de marktplaats. Eén pill per status; de actie (Lever aan,
// Verleng, bekijk) staat ernaast, niet in de kleur.
// Gekleurde status-pills (admin-overzichten gebruiken deze: daar helpt
// kleurcodering juist bij snel scannen).
export const STAGE_STYLES: Record<LinkStage, string> = {
  wacht: "bg-amber-100 text-amber-800",
  behandeling: "bg-sky-100 text-sky-800",
  ingepland: "bg-violet-100 text-violet-800",
  live: "bg-emerald-100 text-emerald-800",
  verloopt: "bg-orange-100 text-orange-800",
  verlopen: "bg-rose-100 text-rose-700",
  geannuleerd: "bg-gray-100 text-gray-600",
};

// Rustige neutrale pill voor de klant-schermen: één grijze stijl voor elke
// status; de kleur zit alleen in het bolletje (STAGE_DOT) ervoor.
export const STAGE_PILL_NEUTRAL = "bg-gray-100 text-gray-700";

// Kleur van het statusbolletje per fase — de enige kleurhint in de nette pill.
export const STAGE_DOT: Record<LinkStage, string> = {
  wacht: "bg-amber-500",
  behandeling: "bg-sky-500",
  ingepland: "bg-violet-500",
  live: "bg-emerald-500",
  verloopt: "bg-orange-500",
  verlopen: "bg-rose-500",
  geannuleerd: "bg-gray-400",
};

export type LinkStatusInput = {
  orderStatus: OrderStatus;
  // Bought for a period (homepage link) — or for good (blog article).
  periodic: boolean;
  publishAt: Date | null;
  writeForMe: boolean;
  articleBody: string | null;
  // Paid for, but its content isn't in yet (see awaitingContent.ts).
  needsContent?: boolean;
  // Checked by the admin and sent to the site (Publiceren); until then it's
  // being checked, even with a day chosen.
  readyToPublish?: boolean;
  placement: { status: string; publishedAt?: Date | null; expiresAt: Date | null; expiredAt: Date | null } | null;
};

export type LinkStatus = { stage: LinkStage; label: string; detail: string };

const DAY_MS = 24 * 60 * 60 * 1000;
export const nlDate = (d: Date) => d.toLocaleDateString("nl-NL", { timeZone: "Europe/Amsterdam" });
// "30-9-2026 om 08:00"
export const nlDateTime = (d: Date) =>
  `${nlDate(d)} om ${d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam" })}`;

export function linkStatus(item: LinkStatusInput, now = new Date()): LinkStatus {
  const p = item.placement;
  if (item.orderStatus === "CANCELLED" || item.orderStatus === "REJECTED") {
    return { stage: "geannuleerd", label: "Geannuleerd", detail: "" };
  }
  if (item.orderStatus === "REFUND_REQUESTED") {
    return { stage: "geannuleerd", label: "Annulering aangevraagd", detail: "Wordt beoordeeld" };
  }
  if (item.needsContent && !p) {
    return { stage: "wacht", label: "Wacht op jouw inhoud", detail: "Nog in te vullen" };
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
  const planned = item.publishAt && item.publishAt > now ? item.publishAt : null;
  if (item.readyToPublish && !p) {
    return planned
      ? { stage: "ingepland", label: "Ingepland", detail: `Online op ${nlDate(planned)}` }
      : { stage: "behandeling", label: "Wordt gepubliceerd", detail: "Binnen een paar minuten online" };
  }
  // A draft in WordPress (sites on an older plugin) is on its way too.
  if (p) return { stage: "behandeling", label: "In behandeling", detail: "Wordt geplaatst" };
  const writing = item.writeForMe && !item.articleBody;
  return {
    stage: "behandeling",
    label: "In behandeling",
    detail: writing ? "Wordt geschreven" : planned ? `Wordt gecontroleerd · online op ${nlDate(planned)}` : "Wordt gecontroleerd",
  };
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
const STAGE_ORDER: LinkStage[] = ["wacht", "verloopt", "behandeling", "ingepland", "live", "verlopen", "geannuleerd"];

// By date (newest or oldest first), website or status — newest first
// within those; links from the same order in a fixed order.
// orderedAt (when given): newest and oldest go by the order's date and
// time, as shown in Mijn orders.
export function sortLinks<
  T extends { id: string; orderNumber: number; domain: string; stage: LinkStage; orderedAt?: Date }
>(rows: T[], sort: OrderSort = "nieuw"): T[] {
  const newest = (a: T, b: T) =>
    (b.orderedAt?.getTime() ?? 0) - (a.orderedAt?.getTime() ?? 0) ||
    b.orderNumber - a.orderNumber ||
    a.id.localeCompare(b.id);
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

// One line for a whole order in Mijn orders: the stage all its links share,
// "Deels live" while some are live and others still on their way, and
// otherwise whatever needs attention first.
export function orderStatus(stages: LinkStage[]): { stage: LinkStage; label: string } {
  const labels: Record<LinkStage, string> = {
    wacht: "Wacht op jouw inhoud",
    behandeling: "In behandeling",
    ingepland: "Ingepland",
    live: "Live",
    verloopt: "Verloopt binnenkort",
    verlopen: "Verlopen",
    geannuleerd: "Geannuleerd",
  };
  if (stages.length === 0) return { stage: "geannuleerd", label: labels.geannuleerd };
  if (stages.every((s) => s === stages[0])) return { stage: stages[0], label: labels[stages[0]] };
  // Something the customer still has to do comes first.
  if (stages.includes("wacht")) return { stage: "wacht", label: labels.wacht };
  if (stages.includes("verloopt")) return { stage: "verloopt", label: labels.verloopt };
  const live = stages.filter((s) => s === "live").length;
  const onTheWay = stages.some((s) => s === "behandeling" || s === "ingepland");
  if (live > 0 && onTheWay) return { stage: "live", label: `Deels live · ${live} van ${stages.length}` };
  const first = STAGE_ORDER.find((s) => stages.includes(s))!;
  return { stage: first, label: labels[first] };
}

// "https://www.site.nl/pagina/" → "site.nl/pagina", for compact display.
export function shortUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
}

// Mijn orders shows this many orders per page.
export const ORDERS_PER_PAGE = 20;
