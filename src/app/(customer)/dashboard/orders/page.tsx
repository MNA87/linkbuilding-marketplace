import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight, FileText, House, MessageSquare } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { unreadForCustomerWhere } from "@/lib/orderMessages";
import { prisma } from "@/lib/prisma";
import { parseBriefLinks } from "@/lib/writingService";
import { hasPeriod } from "@/lib/placementPeriod";
import {
  LINK_TABS,
  STAGE_DOTS,
  STAGE_STYLES,
  inTab,
  linkStatus,
  matchesSearch,
  nlDate,
  parseOrderSort,
  parseTab,
  sortLinks,
} from "@/lib/customerOrders";
import OrdersToolbar from "./OrdersToolbar";

export const metadata: Metadata = { title: "Mijn orders" };

const COLUMNS = "md:grid-cols-[32px_minmax(0,1.1fr)_minmax(0,1.4fr)_170px_180px_130px_16px]";

type Params = { tab?: string; q?: string; soort?: string; sort?: string };

// Every bought link on one page, one row each (renewals aren't rows of
// their own: they only move a link's end date on).
export default async function CustomerOrdersPage({ searchParams }: { searchParams: Promise<Params> }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer") redirect("/login");
  const params = await searchParams;
  const tab = parseTab(params.tab);
  const sort = parseOrderSort(params.sort);
  const type = params.soort === "blog" ? "BLOG_POST" : params.soort === "homepage" ? "HOMEPAGE_LINK" : undefined;

  const [items, unread] = await Promise.all([
    prisma.orderItem.findMany({
      // Orders still in the cart (status NEW) aren't real orders yet — they
      // show up in the winkelmandje instead.
      where: {
        renewsOrderItemId: null,
        order: { customerId: session.user.id, status: { not: "NEW" } },
        websiteProduct: type ? { product: { type } } : undefined,
      },
      include: {
        websiteProduct: { include: { website: true, product: true } },
        placement: true,
        order: { select: { status: true, createdAt: true } },
      },
    }),
    prisma.orderMessage.groupBy({
      by: ["orderItemId"],
      where: unreadForCustomerWhere(session.user.id),
      _count: { _all: true },
    }),
  ]);
  const unreadByItem = new Map(unread.map((u) => [u.orderItemId, u._count._all]));

  const now = new Date();
  const rows = sortLinks(
    items
      .map((item) => {
        const status = linkStatus(
          { ...item, orderStatus: item.order.status, periodic: hasPeriod(item.websiteProduct.product.type) },
          now
        );
        const anchors = item.writeForMe
          ? parseBriefLinks(item.briefLinks).map((l) => l.anchor)
          : item.anchorText
            ? [item.anchorText]
            : [];
        return { id: item.id, item, status, stage: status.stage, orderedAt: item.order.createdAt, anchors };
      })
      .filter((r) => matchesSearch({ domain: r.item.websiteProduct.website.domain, anchors: r.anchors }, params.q ?? "")),
    sort
  );
  const counts = Object.fromEntries(LINK_TABS.map((t) => [t.key, rows.filter((r) => inTab(r.stage, t.key)).length]));
  const shown = rows.filter((r) => inTab(r.stage, tab));

  // A status button keeps the search, kind and order.
  const tabHref = (key: string) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== "tab") sp.set(k, v);
    if (key !== "alle") sp.set("tab", key);
    const query = sp.toString();
    return query ? `/dashboard/orders?${query}` : "/dashboard/orders";
  };

  return (
    <div className="max-w-6xl">
      <h1 className="font-serif text-2xl sm:text-3xl text-ink">Mijn orders</h1>
      <p className="text-sm text-inkSoft mt-1">
        Al je bestelde links. Klik op een link om het artikel, de status en reacties te zien.
      </p>

      <OrdersToolbar />

      <nav className="mt-4 flex flex-wrap gap-2" aria-label="Filter op status">
        {LINK_TABS.map((t) => {
          const active = t.key === tab;
          const amber = t.key === "verloopt" && counts[t.key] > 0 && !active;
          return (
            <Link
              key={t.key}
              href={tabHref(t.key)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                active
                  ? "border-ink bg-ink text-white"
                  : amber
                    ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                    : "border-line bg-surface text-ink/80 hover:bg-gray-50"
              }`}
            >
              {t.label}
              <span className={`tabular-nums ${active ? "text-white/70" : "text-inkSoft"}`}>{counts[t.key]}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 overflow-hidden rounded-xl border border-line bg-surface">
        {shown.length > 0 && (
          <div className={`hidden md:grid ${COLUMNS} gap-x-4 bg-gray-50 px-5 py-2.5 text-xs font-medium text-inkSoft`}>
            <span />
            <span>Website</span>
            <span>Ankertekst</span>
            <span>Status</span>
            <span>Datum</span>
            <span />
            <span />
          </div>
        )}

        {shown.map(({ item, status, anchors }) => {
          const href = `/dashboard/orders/link/${item.id}`;
          const isHomepage = item.websiteProduct.product.type === "HOMEPAGE_LINK";
          const Icon = isHomepage ? House : FileText;
          const newCount = unreadByItem.get(item.id) ?? 0;
          const live = (status.stage === "live" || status.stage === "verloopt") && item.placement?.liveUrl;
          return (
            <div
              key={item.id}
              className={`relative grid grid-cols-[32px_minmax(0,1fr)_auto] ${COLUMNS} items-center gap-x-4 gap-y-1.5 border-t border-line/70 px-4 py-3.5 transition-colors first:border-t-0 hover:bg-gray-50/70 sm:px-5`}
            >
              {/* The whole row opens the details; the links sit above this one. */}
              <Link href={href} className="absolute inset-0" aria-label={`Details ${item.websiteProduct.website.domain}`} />
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                  isHomepage ? "bg-teal-50 text-teal-600" : "bg-blue-50 text-blue-600"
                }`}
              >
                <Icon size={16} />
              </span>
              <div className="min-w-0">
                <div className="truncate text-ink">{item.websiteProduct.website.domain}</div>
                <div className="mt-0.5 text-xs text-inkSoft">Besteld {nlDate(item.order.createdAt)}</div>
              </div>
              <div className="col-start-2 row-start-2 min-w-0 md:col-start-auto md:row-start-auto">
                <div className="truncate text-sm text-ink/80">{anchors.join(", ") || "—"}</div>
                {newCount > 0 && (
                  <Link
                    href={`${href}#reacties`}
                    className="relative z-10 mt-0.5 flex w-fit items-center gap-1.5 text-xs font-semibold text-brand hover:underline"
                  >
                    <MessageSquare size={12} />
                    {newCount === 1 ? "1 nieuwe reactie" : `${newCount} nieuwe reacties`}
                  </Link>
                )}
              </div>
              <div className="col-start-3 row-start-1 justify-self-end md:col-start-auto md:row-start-auto md:justify-self-start">
                <span
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${STAGE_STYLES[status.stage]}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${STAGE_DOTS[status.stage]}`} />
                  {status.label}
                </span>
              </div>
              <div className="col-start-2 whitespace-nowrap text-sm text-ink/80 md:col-start-auto">{status.detail}</div>
              <div className="relative z-10 col-start-2 whitespace-nowrap text-sm empty:hidden md:col-start-auto md:text-right md:empty:block">
                {status.stage === "verloopt" ? (
                  <Link href={`${href}#verlengen`} className="font-medium text-brand hover:underline">
                    Verlengen →
                  </Link>
                ) : live ? (
                  <a href={item.placement!.liveUrl!} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                    {isHomepage ? "Bekijk link" : "Bekijk artikel"} →
                  </a>
                ) : null}
              </div>
              <ChevronRight size={16} className="hidden text-inkSoft md:block" />
            </div>
          );
        })}

        {shown.length === 0 && (
          <div className="px-5 py-10 text-center text-sm text-inkSoft">
            {items.length === 0 && !params.q && !type ? (
              <>
                Je hebt nog geen links besteld.{" "}
                <Link href="/marketplace?type=BLOG_POST" className="text-brand hover:underline">
                  Bekijk het aanbod
                </Link>
                .
              </>
            ) : (
              "Geen links gevonden met deze filters."
            )}
          </div>
        )}
      </div>
    </div>
  );
}
