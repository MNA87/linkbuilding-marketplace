import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ExternalLink } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBriefLinks } from "@/lib/writingService";
import { LINK_TABS, STAGE_STYLES, inTab, linkStatus, nlDate, parseTab, shortUrl, sortLinks } from "@/lib/customerOrders";

export const metadata: Metadata = { title: "Mijn orders" };

const COLUMNS = "md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_165px_170px_190px_16px]";

// Every bought link on one page, one row each (renewals aren't rows of
// their own: they only move a link's end date on).
export default async function CustomerOrdersPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer") redirect("/login");
  const tab = parseTab((await searchParams).tab);

  const items = await prisma.orderItem.findMany({
    // Orders still in the cart (status NEW) aren't real orders yet — they
    // show up in the winkelmandje instead.
    where: { renewsOrderItemId: null, order: { customerId: session.user.id, status: { not: "NEW" } } },
    include: {
      websiteProduct: { include: { website: true, product: true } },
      placement: true,
      order: { select: { orderNumber: true, status: true, createdAt: true } },
    },
  });

  const now = new Date();
  const rows = sortLinks(
    items.map((item) => {
      const status = linkStatus({ ...item, orderStatus: item.order.status }, now);
      const brief = parseBriefLinks(item.briefLinks)[0];
      return {
        id: item.id,
        item,
        status,
        stage: status.stage,
        orderedAt: item.order.createdAt,
        anchor: item.anchorText ?? brief?.anchor ?? null,
        target: item.targetUrl ?? brief?.url ?? null,
      };
    })
  );
  const counts = Object.fromEntries(LINK_TABS.map((t) => [t.key, rows.filter((r) => inTab(r.stage, t.key)).length]));
  const shown = rows.filter((r) => inTab(r.stage, tab));

  return (
    <div className="max-w-6xl">
      <h1 className="font-serif text-2xl sm:text-3xl text-ink">Mijn orders</h1>
      <p className="text-sm text-inkSoft mt-1">
        Al je bestelde links op één plek: wat er gebeurt, wat live staat en wat je kunt verlengen.
      </p>

      <nav className="mt-5 flex gap-1 overflow-x-auto border-b border-line" aria-label="Filter op status">
        {LINK_TABS.map((t) => {
          const active = t.key === tab;
          return (
            <Link
              key={t.key}
              href={t.key === "alle" ? "/dashboard/orders" : `/dashboard/orders?tab=${t.key}`}
              className={`-mb-px flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors ${
                active ? "border-ink font-semibold text-ink" : "border-transparent text-inkSoft hover:text-ink"
              }`}
            >
              {t.label}
              <span
                className={`rounded-full px-1.5 text-[11px] leading-[18px] tabular-nums ${
                  t.key === "verloopt" && counts[t.key] > 0 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-inkSoft"
                }`}
              >
                {counts[t.key]}
              </span>
            </Link>
          );
        })}
      </nav>

      {shown.length > 0 && (
        <div className={`hidden md:grid ${COLUMNS} gap-x-4 px-5 pt-4 pb-1 text-xs font-medium text-inkSoft`}>
          <span>Website</span>
          <span>Ankertekst → doel</span>
          <span>Status</span>
          <span>Datum</span>
          <span />
          <span />
        </div>
      )}

      {shown.map(({ item, status, anchor, target }) => {
        const href = `/dashboard/orders/link/${item.id}`;
        const live = status.stage === "live" || status.stage === "verloopt";
        const renewable = live && item.placement?.expiresAt;
        return (
          <div
            key={item.id}
            className={`relative mt-2 grid grid-cols-[minmax(0,1fr)_auto] ${COLUMNS} gap-x-4 gap-y-2 items-center rounded-xl border bg-surface px-4 sm:px-5 py-3.5 transition-shadow hover:shadow-sm ${
              status.stage === "verloopt" ? "border-amber-300" : "border-line"
            }`}
          >
            {/* The whole row opens the details; the buttons sit above this link. */}
            <Link href={href} className="absolute inset-0 rounded-xl" aria-label={`Details ${item.websiteProduct.website.domain}`} />
            <div className="min-w-0">
              <div className="text-ink truncate">{item.websiteProduct.website.domain}</div>
              <div className="text-xs text-inkSoft mt-0.5">
                {item.websiteProduct.product.type === "HOMEPAGE_LINK" ? "Homepage link" : "Blog link"} · #
                {item.order.orderNumber} · {nlDate(item.order.createdAt)}
              </div>
            </div>
            <div className="hidden md:block min-w-0">
              <div className="text-sm text-ink truncate">{anchor ?? "—"}</div>
              {target && <div className="text-xs text-inkSoft truncate">→ {shortUrl(target)}</div>}
            </div>
            <div className="justify-self-end md:justify-self-start">
              <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${STAGE_STYLES[status.stage]}`}>
                {status.label}
              </span>
            </div>
            <div className="col-span-2 md:col-span-1 whitespace-nowrap text-sm text-ink/80">{status.detail}</div>
            <div className="relative z-10 col-span-2 md:col-span-1 flex items-center justify-start md:justify-end gap-2 empty:hidden md:empty:flex">
              {live && item.placement?.liveUrl && (
                <a
                  href={item.placement.liveUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-line px-3 py-1.5 text-sm text-ink/80 hover:bg-gray-50"
                >
                  <ExternalLink size={13} />
                  Bekijken
                </a>
              )}
              {renewable && (
                <Link
                  href={`${href}#verlengen`}
                  className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ${
                    status.stage === "verloopt" ? "btn-primary" : "border border-line text-ink/80 hover:bg-gray-50"
                  }`}
                >
                  Verlengen
                </Link>
              )}
            </div>
            <ChevronRight size={16} className="hidden md:block text-inkSoft" />
          </div>
        );
      })}

      {shown.length === 0 && (
        <div className="mt-4 rounded-xl border border-line bg-surface px-5 py-10 text-center text-sm text-inkSoft">
          {rows.length === 0 ? (
            <>
              Je hebt nog geen links besteld.{" "}
              <Link href="/marketplace?type=BLOG_POST" className="text-brand hover:underline">
                Bekijk het aanbod
              </Link>
              .
            </>
          ) : (
            "Geen links in deze lijst."
          )}
        </div>
      )}
    </div>
  );
}
