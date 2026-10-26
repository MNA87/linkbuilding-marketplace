import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Archive, Folder } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { unreadForCustomerWhere } from "@/lib/orderMessages";
import { prisma } from "@/lib/prisma";
import { itemPrice, parseBriefLinks } from "@/lib/writingService";
import { isAwaitingContent } from "@/lib/awaitingContent";
import {
  LINK_TABS,
  ORDERS_PER_PAGE,
  STAGE_STYLES,
  inTab,
  linkStatus,
  matchesSearch,
  orderStatus,
  parseOrderSort,
  parseTab,
  sortLinks,
} from "@/lib/customerOrders";
import OrdersToolbar, { OrderSortChips } from "./OrdersToolbar";
import ProjectFilter from "./ProjectFilter";
import OrdersList, { type OrderRow } from "./OrdersList";
import Pagination from "@/components/Pagination";
import { currentPage } from "@/lib/pagination";

export const metadata: Metadata = { title: "Mijn orders" };

const orderDay = (d: Date) =>
  d.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Amsterdam" });

type Params = { tab?: string; q?: string; soort?: string; sort?: string; pagina?: string; project?: string; archief?: string };

// One row per order (a checkout can hold several links); the links, their
// articles and the reactions are on the order's own page. Orders that only
// renewed links aren't listed — they just move an end date on.
export default async function CustomerOrdersPage({ searchParams }: { searchParams: Promise<Params> }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer") redirect("/login");
  const params = await searchParams;
  const tab = parseTab(params.tab);
  const sort = parseOrderSort(params.sort);
  const type = params.soort === "blog" ? "BLOG_POST" : params.soort === "homepage" ? "HOMEPAGE_LINK" : undefined;

  const [orders, unread] = await Promise.all([
    prisma.order.findMany({
      // Orders still in the cart (status NEW) aren't real orders yet — they
      // show up in the winkelmandje instead.
      where: {
        customerId: session.user.id,
        status: { not: "NEW" },
        items: { some: { renewsOrderItemId: null, ...(type ? { websiteProduct: { product: { type } } } : {}) } },
      },
      include: {
        items: {
          include: { websiteProduct: { include: { website: true, product: true } }, placement: true, project: true },
          orderBy: { id: "asc" },
        },
      },
    }),
    prisma.orderMessage.groupBy({
      by: ["orderId"],
      where: unreadForCustomerWhere(session.user.id),
      _count: { _all: true },
    }),
  ]);
  const unreadByOrder = new Map(unread.map((u) => [u.orderId, u._count._all]));

  // Project = de agency-klant/campagne, een label per regel (OrderItem.projectId;
  // de order zelf hangt aan het verzamel-project "Bestellingen"). Tel per project
  // hoeveel plaatsingen er zijn, plus de regels zonder project.
  const projectMeta = new Map<string, { name: string; count: number }>();
  let noneCount = 0;
  for (const o of orders) {
    for (const it of o.items) {
      if (it.renewsOrderItemId) continue;
      if (type && it.websiteProduct.product.type !== type) continue;
      if (it.projectId && it.project) {
        const m = projectMeta.get(it.projectId) ?? { name: it.project.name, count: 0 };
        m.count += 1;
        projectMeta.set(it.projectId, m);
      } else {
        noneCount += 1;
      }
    }
  }
  const projectList = Array.from(projectMeta, ([id, m]) => ({ id, ...m })).sort((a, b) => a.name.localeCompare(b.name, "nl"));
  // Alleen een bekende filter laten gelden (voorkomt een lege lijst bij een rare url).
  const projectFilter = params.project && (params.project === "none" || projectMeta.has(params.project)) ? params.project : undefined;
  const inProject = (order: (typeof orders)[number]) =>
    !projectFilter ||
    order.items.some((i) => !i.renewsOrderItemId && (projectFilter === "none" ? !i.projectId : i.projectId === projectFilter));

  const now = new Date();
  const rows = sortLinks(
    orders
      .map((order) => {
        const links = order.items
          .filter((i) => !i.renewsOrderItemId)
          .map((item) => ({
            item,
            status: linkStatus(
              {
                ...item,
                orderStatus: order.status,
                periodic: item.periodic,
                needsContent: isAwaitingContent(item, order.status, item.websiteProduct.product.type),
              },
              now
            ),
          }));
        const summary = orderStatus(links.map((l) => l.status.stage));
        const anchors = links.flatMap(({ item }) =>
          item.writeForMe ? parseBriefLinks(item.briefLinks).map((l) => l.anchor) : item.anchorText ? [item.anchorText] : []
        );
        return {
          id: order.id,
          order,
          links,
          summary,
          // Every link's stage counts for the status buttons.
          stages: links.map((l) => l.status.stage),
          stage: summary.stage,
          orderNumber: order.orderNumber,
          // Paid, or (not paid) when it was placed.
          orderedAt: order.paidAt ?? order.createdAt,
          domain: links[0]?.item.websiteProduct.website.domain ?? "",
          domains: links.map((l) => l.item.websiteProduct.website.domain),
          anchors,
          amount: order.items.reduce((sum, i) => sum + itemPrice(i).toNumber(), 0),
        };
      })
      .filter((r) =>
        [r.domain, ...r.domains].some(
          (domain) => matchesSearch({ domain, orderNumber: r.orderNumber, anchors: r.anchors }, params.q ?? "")
        )
      )
      .filter((r) => inProject(r.order)),
    sort
  );
  // Archiveren: een afgehandelde order kan de klant wegleggen (customerArchivedAt).
  // Standaard tonen we de niet-gearchiveerde; "Gearchiveerd" (?archief=1) toont
  // juist de weggelegde orders. Binnen beide blijven de status-filters werken.
  const archief = params.archief === "1";
  const isArchived = (r: (typeof rows)[number]) => r.order.customerArchivedAt != null;
  const archivedCount = rows.filter(isArchived).length;
  const scope = rows.filter((r) => (archief ? isArchived(r) : !isArchived(r)));

  // Totaal van de plaatsingen in het gekozen project (over de getoonde rijen).
  const projActive = projectFilter
    ? projectFilter === "none"
      ? { name: "Geen project" }
      : projectMeta.get(projectFilter)
    : undefined;
  let projCount = 0;
  let projTotal = 0;
  if (projectFilter) {
    for (const r of scope) {
      for (const i of r.order.items) {
        if (i.renewsOrderItemId) continue;
        const match = projectFilter === "none" ? !i.projectId : i.projectId === projectFilter;
        if (match) {
          projCount += 1;
          projTotal += itemPrice(i).toNumber();
        }
      }
    }
  }
  const counts = Object.fromEntries(
    LINK_TABS.map((t) => [t.key, scope.filter((r) => r.stages.some((s) => inTab(s, t.key))).length])
  );
  const matching = scope.filter((r) => r.stages.some((s) => inTab(s, tab)));
  const pages = Math.max(1, Math.ceil(matching.length / ORDERS_PER_PAGE));
  const page = currentPage(params.pagina, pages);
  const shown = matching.slice((page - 1) * ORDERS_PER_PAGE, page * ORDERS_PER_PAGE);
  const pageHref = (n: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== "pagina") sp.set(k, v);
    if (n > 1) sp.set("pagina", String(n));
    const query = sp.toString();
    return query ? `/dashboard/orders?${query}` : "/dashboard/orders";
  };

  // A status button keeps the search, kind and order.
  const tabHref = (key: string) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== "tab" && k !== "pagina") sp.set(k, v);
    if (key !== "alle") sp.set("tab", key);
    const query = sp.toString();
    return query ? `/dashboard/orders?${query}` : "/dashboard/orders";
  };

  // In/uit het archief: behoudt zoeken, soort en project, maar begint schoon op
  // "Alle" (de status-telling verschilt tussen actief en archief).
  const archiefHref = (on: boolean) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== "archief" && k !== "tab" && k !== "pagina") sp.set(k, v);
    if (on) sp.set("archief", "1");
    const query = sp.toString();
    return query ? `/dashboard/orders?${query}` : "/dashboard/orders";
  };

  // Een project-chip houdt de overige filters vast; "Alle projecten" = id null.
  const projectHref = (id: string | null) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== "project" && k !== "pagina") sp.set(k, v);
    if (id) sp.set("project", id);
    const query = sp.toString();
    return query ? `/dashboard/orders?${query}` : "/dashboard/orders";
  };
  const projChip = (active: boolean) =>
    `inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition-colors ${
      active
        ? "border-[var(--btn-pay-bg)] bg-[var(--pay-soft)] font-semibold text-[var(--btn-pay-bg)]"
        : "border-line bg-surface text-ink/80 hover:bg-gray-50"
    }`;

  // De getoonde orders als platte props voor de kaartrijen-component (client,
  // vanwege de selectievakjes + bulk-archiveren).
  const listRows: OrderRow[] = shown.map(({ order, links, summary, amount, orderedAt }) => {
    const first = links[0]?.item;
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      href: `/dashboard/orders/${order.id}`,
      kind: first?.websiteProduct.product.type === "HOMEPAGE_LINK" ? "homepage" : "blog",
      domain: first?.websiteProduct.website.domain ?? "—",
      extra: Math.max(0, links.length - 1),
      stageLabel: summary.label,
      stageClass: STAGE_STYLES[summary.stage],
      dateLabel: orderDay(orderedAt),
      amountLabel: amount.toFixed(2).replace(".", ","),
      unread: unreadByOrder.get(order.id) ?? 0,
      archived: order.customerArchivedAt != null,
    };
  });

  return (
    <div className="max-w-6xl">
      <h1 className="font-serif text-2xl sm:text-3xl text-ink">Mijn orders</h1>

      <OrdersToolbar />

      <nav className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:mt-4 md:flex-wrap md:overflow-visible md:px-0 md:pb-0 [&::-webkit-scrollbar]:hidden" aria-label="Filter op status">
        {LINK_TABS.map((t) => {
          const active = t.key === tab;
          const amber = (t.key === "verloopt" || t.key === "wacht") && counts[t.key] > 0 && !active;
          return (
            <Link
              key={t.key}
              href={tabHref(t.key)}
              className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition-colors ${
                active
                  ? // Soft action colour, calmer than black (Instellingen → Knopkleuren).
                    "border-[var(--btn-pay-bg)] bg-[var(--pay-soft)] font-semibold text-[var(--btn-pay-bg)]"
                  : amber
                    ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                    : "border-line bg-surface text-ink/80 hover:bg-gray-50"
              }`}
            >
              {t.label}
              <span className={`tabular-nums ${active ? "" : "text-inkSoft"}`}>{counts[t.key]}</span>
            </Link>
          );
        })}
        {/* Gearchiveerd als aparte chip aan het eind — alleen als er iets in het
            archief zit (of je er nu in zit). */}
        {(archivedCount > 0 || archief) && (
          <>
            <span className="my-1.5 hidden w-px shrink-0 bg-line md:block" aria-hidden />
            <Link
              href={archiefHref(!archief)}
              className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition-colors ${
                archief
                  ? "border-[var(--btn-pay-bg)] bg-[var(--pay-soft)] font-semibold text-[var(--btn-pay-bg)]"
                  : "border-line bg-surface text-ink/80 hover:bg-gray-50"
              }`}
            >
              <Archive size={13} />
              Gearchiveerd
              <span className={`tabular-nums ${archief ? "" : "text-inkSoft"}`}>{archivedCount}</span>
            </Link>
          </>
        )}
        {/* Phone: kind and order at the end of the same row. */}
        <span className="my-1.5 w-px shrink-0 bg-line md:hidden" aria-hidden />
        <span className="flex shrink-0 gap-2 md:hidden">
          <OrderSortChips />
        </span>
      </nav>

      {archief && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-gray-50 px-4 py-2.5 text-sm">
          <span className="inline-flex items-center gap-2 text-ink">
            <Archive size={15} className="text-inkSoft" />
            Je bekijkt het <span className="font-semibold">archief</span>
            <span className="text-inkSoft">· gearchiveerde orders tellen niet mee in je gewone lijst</span>
          </span>
          <Link href={archiefHref(false)} className="whitespace-nowrap font-semibold text-[var(--btn-pay-bg)] hover:underline">
            Terug naar orders &larr;
          </Link>
        </div>
      )}

      {/* Filter op project (de agency-klant/campagne). Weinig projecten → snelle
          chips; veel projecten → een compacte dropdown die netjes schaalt. */}
      {projectList.length > 0 && projectList.length <= 5 && (
        <nav className="mt-2.5 flex flex-wrap gap-2" aria-label="Filter op project">
          <Link href={projectHref(null)} className={projChip(!projectFilter)}>
            Alle projecten
          </Link>
          {projectList.map((p) => (
            <Link key={p.id} href={projectHref(p.id)} className={projChip(projectFilter === p.id)}>
              <Folder size={13} />
              {p.name}
              <span className={`tabular-nums ${projectFilter === p.id ? "" : "text-inkSoft"}`}>{p.count}</span>
            </Link>
          ))}
          {noneCount > 0 && (
            <Link href={projectHref("none")} className={projChip(projectFilter === "none")}>
              Geen project
              <span className={`tabular-nums ${projectFilter === "none" ? "" : "text-inkSoft"}`}>{noneCount}</span>
            </Link>
          )}
        </nav>
      )}
      {projectList.length > 5 && (
        <div className="mt-2.5">
          <ProjectFilter projects={projectList} noneCount={noneCount} value={projectFilter ?? ""} />
        </div>
      )}

      {projActive && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-[var(--pay-soft)] px-4 py-2.5 text-sm">
          <span className="text-ink">
            Gefilterd op <span className="font-semibold text-[var(--btn-pay-bg)]">{projActive.name}</span>
            <span className="text-inkSoft">
              {" "}· {projCount} {projCount === 1 ? "plaatsing" : "plaatsingen"}
            </span>
          </span>
          <span className="inline-flex items-center gap-4">
            <span className="inline-flex items-baseline gap-2">
              <span className="text-xs text-inkSoft">totaal</span>
              <span className="font-serif text-lg font-extrabold tabular-nums text-ink">€{projTotal.toFixed(2).replace(".", ",")}</span>
            </span>
            {projectFilter && projectFilter !== "none" && (
              <Link href={`/dashboard/projects/${projectFilter}`} className="whitespace-nowrap text-sm font-semibold text-[var(--btn-pay-bg)] hover:underline">
                Bekijk project &rarr;
              </Link>
            )}
          </span>
        </div>
      )}

      {/* Kaartrijen (Voorstel A) + multi-select bulk-archiveren. Eén responsive
          weergave: de kaarten stapelen op mobiel vanzelf netjes. */}
      {shown.length > 0 ? (
        <OrdersList rows={listRows} archief={archief} />
      ) : (
        <div className="mt-4 rounded-xl border border-line bg-surface px-5 py-10 text-center text-sm text-inkSoft">
          {archief ? (
            "Je hebt geen gearchiveerde orders."
          ) : orders.length === 0 && !params.q && !type ? (
            <>
              Je hebt nog geen links besteld.{" "}
              <Link href="/marketplace?type=BLOG_POST" className="text-brand hover:underline">
                Bekijk het aanbod
              </Link>
              .
            </>
          ) : (
            "Geen orders gevonden met deze filters."
          )}
        </div>
      )}

      <Pagination page={page} perPage={ORDERS_PER_PAGE} total={matching.length} noun="orders" href={pageHref} />
    </div>
  );
}
