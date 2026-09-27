import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowUpDown, ChevronRight } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { unreadForCustomerWhere } from "@/lib/orderMessages";
import { prisma } from "@/lib/prisma";
import { itemPrice, parseBriefLinks } from "@/lib/writingService";
import { isAwaitingContent } from "@/lib/awaitingContent";
import { hasPeriod } from "@/lib/placementPeriod";
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
import OrdersToolbar from "./OrdersToolbar";
import Pagination from "@/components/Pagination";
import { currentPage } from "@/lib/pagination";

export const metadata: Metadata = { title: "Mijn orders" };

// Fixed widths for everything but the amount, so Website doesn't take it all.
const COLUMNS = "md:grid-cols-[64px_160px_250px_196px_minmax(0,1fr)_56px]";

const orderDay = (d: Date) =>
  d.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Amsterdam" });
const orderTime = (d: Date) =>
  d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam" });

type Params = { tab?: string; q?: string; soort?: string; sort?: string; pagina?: string };

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
          include: { websiteProduct: { include: { website: true, product: true } }, placement: true },
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
                periodic: hasPeriod(item.websiteProduct.product.type),
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
      ),
    sort
  );
  const counts = Object.fromEntries(
    LINK_TABS.map((t) => [t.key, rows.filter((r) => r.stages.some((s) => inTab(s, t.key))).length])
  );
  const matching = rows.filter((r) => r.stages.some((s) => inTab(s, tab)));
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

  // Clicking a column header sorts by it (like the marketplace).
  const sortHeader = (label: string, value: string, active = sort === value) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== "sort" && k !== "pagina") sp.set(k, v);
    if (value !== "nieuw") sp.set("sort", value);
    return (
      <Link
        href={`/dashboard/orders?${sp.toString()}`}
        className={`inline-flex items-center gap-1 hover:text-ink ${active ? "text-ink" : ""}`}
      >
        {label}
        <ArrowUpDown size={11} />
      </Link>
    );
  };

  return (
    <div className="max-w-6xl">
      <h1 className="font-serif text-2xl sm:text-3xl text-ink">Mijn orders</h1>

      <OrdersToolbar />

      <nav className="mt-4 flex flex-wrap gap-2" aria-label="Filter op status">
        {LINK_TABS.map((t) => {
          const active = t.key === tab;
          const amber = (t.key === "verloopt" || t.key === "wacht") && counts[t.key] > 0 && !active;
          return (
            <Link
              key={t.key}
              href={tabHref(t.key)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
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
      </nav>

      <div className="mt-4 overflow-hidden rounded-xl border border-line bg-surface">
        {shown.length > 0 && (
          <div className={`hidden md:grid ${COLUMNS} gap-x-4 bg-gray-50 px-5 py-2.5 text-xs font-medium text-inkSoft`}>
            <span>{sortHeader("Order", sort === "nieuw" ? "oud" : "nieuw", sort === "nieuw" || sort === "oud")}</span>
            <span>Datum</span>
            <span>{sortHeader("Website", "website")}</span>
            <span>{sortHeader("Status", "status")}</span>
            <span>Bedrag</span>
            <span className="text-right">Details</span>
          </div>
        )}

        {shown.map(({ order, links, summary, amount, orderedAt }) => {
          const href = `/dashboard/orders/${order.id}`;
          const newCount = unreadByOrder.get(order.id) ?? 0;
          const first = links[0]?.item;
          return (
            <div
              key={order.id}
              className={`group relative grid grid-cols-[minmax(0,1fr)_auto] ${COLUMNS} items-center gap-x-4 gap-y-1.5 border-t border-line/70 px-4 py-3.5 transition-colors first:border-t-0 hover:bg-gray-50/70 sm:px-5`}
            >
              {/* The whole row opens the order; the links sit above this one. */}
              <Link href={href} className="absolute inset-0" aria-label={`Order ${order.orderNumber} bekijken`} />
              <span className="text-sm tabular-nums text-ink">#{order.orderNumber}</span>
              <span className="hidden whitespace-nowrap text-sm tabular-nums text-ink/80 md:block">
                {orderDay(orderedAt)} <span className="text-inkSoft">{orderTime(orderedAt)}</span>
              </span>
              <div className="col-span-2 row-start-2 min-w-0 md:col-span-1 md:row-start-auto">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-ink">{first?.websiteProduct.website.domain}</span>
                  {links.length > 1 && (
                    <span className="shrink-0 whitespace-nowrap rounded-md border border-line bg-gray-100 px-1.5 py-0.5 text-xs text-ink/70">
                      +{links.length - 1} andere
                    </span>
                  )}
                </span>
                {newCount > 0 && (
                  <Link
                    href={`${href}#reacties`}
                    className="relative z-10 block w-fit text-xs font-semibold text-brand hover:underline"
                  >
                    {newCount === 1 ? "1 nieuwe reactie" : `${newCount} nieuwe reacties`}
                  </Link>
                )}
              </div>
              {/* Every status pill the same width, so the column reads calmly. */}
              <div className="col-start-2 row-start-1 justify-self-end md:col-start-auto md:row-start-auto md:justify-self-start">
                <span
                  className={`inline-flex w-[176px] items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${STAGE_STYLES[summary.stage]}`}
                >
                  {summary.label}
                </span>
              </div>
              <span className="hidden text-sm tabular-nums text-ink/80 md:block">€{amount.toFixed(2).replace(".", ",")}</span>
              {/* Where the order's links, articles and actions are. */}
              <span className="hidden justify-self-end md:block">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-inkSoft transition-colors group-hover:bg-[var(--btn-pay-bg)] group-hover:text-white">
                  <ChevronRight size={16} />
                </span>
              </span>
            </div>
          );
        })}

        {shown.length === 0 && (
          <div className="px-5 py-10 text-center text-sm text-inkSoft">
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
      </div>

      <Pagination page={page} perPage={ORDERS_PER_PAGE} total={matching.length} noun="orders" href={pageHref} />
    </div>
  );
}
