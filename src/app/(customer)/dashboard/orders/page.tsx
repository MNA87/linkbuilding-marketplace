import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { unreadForCustomerWhere } from "@/lib/orderMessages";
import { prisma } from "@/lib/prisma";
import { itemPrice, parseBriefLinks } from "@/lib/writingService";
import { isAwaitingContent } from "@/lib/awaitingContent";
import {
  STATUS_GROUPS,
  ORDERS_PER_PAGE,
  STAGE_STYLES,
  inGroup,
  linkStatus,
  matchesSearch,
  orderStatus,
  parseOrderSort,
  parseGroup,
  sortLinks,
} from "@/lib/customerOrders";
import OrdersControls from "./OrdersControls";
import OrdersList, { type OrderRow } from "./OrdersList";
import Pagination from "@/components/Pagination";
import { currentPage } from "@/lib/pagination";

export const metadata: Metadata = { title: "Mijn orders" };

const orderDay = (d: Date) =>
  `${d.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Amsterdam" })} · ${d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam" })}`;

type Params = { tab?: string; q?: string; soort?: string; sort?: string; pagina?: string; project?: string };

// One row per order (a checkout can hold several links); the links, their
// articles and the reactions are on the order's own page. Orders that only
// renewed links aren't listed — they just move an end date on.
export default async function CustomerOrdersPage({ searchParams }: { searchParams: Promise<Params> }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer") redirect("/login");
  const params = await searchParams;
  const tab = parseGroup(params.tab);
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
  // Tel per project het aantal ORDERS (niet losse plaatsingen), zodat de teller
  // in de dropdown overeenkomt met wat je in de lijst ziet (de lijst is per
  // order; één order kan meerdere links bevatten). Het aantal plaatsingen staat
  // in de banner zodra je op een project filtert.
  const projectMeta = new Map<string, { name: string; orders: Set<string> }>();
  const noneOrders = new Set<string>();
  for (const o of orders) {
    for (const it of o.items) {
      if (it.renewsOrderItemId) continue;
      if (type && it.websiteProduct.product.type !== type) continue;
      if (it.projectId && it.project) {
        const m = projectMeta.get(it.projectId) ?? { name: it.project.name, orders: new Set<string>() };
        m.orders.add(o.id);
        projectMeta.set(it.projectId, m);
      } else {
        noneOrders.add(o.id);
      }
    }
  }
  const noneCount = noneOrders.size;
  const projectList = Array.from(projectMeta, ([id, m]) => ({ id, name: m.name, count: m.orders.size })).sort((a, b) => a.name.localeCompare(b.name, "nl"));
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

  // Totaal van de plaatsingen in het gekozen project (over de getoonde rijen).
  const projActive = projectFilter
    ? projectFilter === "none"
      ? { name: "Geen project" }
      : projectMeta.get(projectFilter)
    : undefined;
  let projCount = 0;
  let projTotal = 0;
  if (projectFilter) {
    for (const r of rows) {
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
    STATUS_GROUPS.map((g) => [g.key, rows.filter((r) => r.stages.some((s) => inGroup(s, g.key))).length])
  );
  const matching = rows.filter((r) => r.stages.some((s) => inGroup(s, tab)));
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

  // De getoonde orders als platte props voor de kaartrijen-component.
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
    };
  });

  return (
    <div className="max-w-6xl">
      <h1 className="font-serif text-2xl sm:text-3xl text-ink">Mijn orders</h1>

      {/* Rustige filterregel: zoeken + project-dropdown + "Filters" (soort/sorteren). */}
      <OrdersControls projects={projectList} noneCount={noneCount} projectValue={projectFilter ?? ""} />

      {/* Status als begrijpelijke groepen (segment-knop). */}
      <div className="mt-3">
        <div className="inline-flex rounded-xl border border-line bg-surface p-0.5" role="tablist" aria-label="Filter op status">
          {STATUS_GROUPS.map((g) => {
            const active = g.key === tab;
            return (
              <Link
                key={g.key}
                href={tabHref(g.key)}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm transition-colors ${
                  active ? "bg-[var(--pay-soft)] font-semibold text-[var(--btn-pay-bg)]" : "text-ink/70 hover:text-ink"
                }`}
              >
                {g.label}
                <span className={`tabular-nums text-xs ${active ? "text-[var(--btn-pay-bg)]" : "text-inkSoft"}`}>{counts[g.key]}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {projActive && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-[var(--pay-soft)] px-4 py-2.5 text-sm">
          <span className="text-ink">
            Gefilterd op <span className="font-semibold text-[var(--btn-pay-bg)]">{projActive.name}</span>
            <span className="text-inkSoft">
              {" "}· {rows.length} {rows.length === 1 ? "order" : "orders"} · {projCount} {projCount === 1 ? "plaatsing" : "plaatsingen"}
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

      {/* Eén klikbare lijst — de hele kaart opent de order. */}
      {shown.length > 0 ? (
        <OrdersList rows={listRows} />
      ) : (
        <div className="mt-4 rounded-xl border border-line bg-surface px-5 py-10 text-center text-sm text-inkSoft">
          {orders.length === 0 && !params.q && !type ? (
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
