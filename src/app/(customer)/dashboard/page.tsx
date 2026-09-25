import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import StatusBadge from "@/components/StatusBadge";

export const metadata: Metadata = { title: "Dashboard" };

export default async function CustomerDashboardPage() {
  const session = await getServerSession(authOptions);
  const companyId = session!.user.companyId!;

  const paidWhere = { customer: { companyId }, status: { not: "NEW" as const } };

  const [orderCount, liveBlogLinks, liveHomepageLinks, pendingItems, spendResult, recentOrders] =
    await Promise.all([
      prisma.order.count({ where: paidWhere }),
      prisma.orderItem.count({
        where: {
          order: paidWhere,
          websiteProduct: { product: { type: "BLOG_POST" } },
          placement: { liveUrl: { not: null } },
        },
      }),
      prisma.orderItem.count({
        where: {
          order: paidWhere,
          websiteProduct: { product: { type: "HOMEPAGE_LINK" } },
          placement: { liveUrl: { not: null } },
        },
      }),
      prisma.orderItem.count({
        where: { order: paidWhere, OR: [{ placement: null }, { placement: { liveUrl: null } }] },
      }),
      prisma.orderItem.aggregate({
        where: { order: paidWhere },
        _sum: { customerPriceSnap: true, writingFeeSnap: true },
      }),
      prisma.order.findMany({
        where: paidWhere,
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { items: { include: { websiteProduct: { include: { website: true } } } } },
      }),
    ]);

  const totalSpent = (spendResult._sum.customerPriceSnap?.toNumber() ?? 0) + (spendResult._sum.writingFeeSnap?.toNumber() ?? 0);

  const tiles = [
    { label: "Live blog links", value: liveBlogLinks, href: "/dashboard/links#blog", cta: "Bekijk blog links" },
    {
      label: "Live homepage links",
      value: liveHomepageLinks,
      href: "/dashboard/links#homepage",
      cta: "Bekijk homepage links",
    },
    { label: "In behandeling", value: pendingItems, href: "/dashboard/orders", cta: "Bekijk orders" },
    { label: "Totaal besteed (excl. BTW)", value: `€${totalSpent.toFixed(2)}`, href: "/dashboard/invoices", cta: "Bekijk facturen" },
  ];

  const shortcuts = [
    { label: "Nieuwe link bestellen", href: "/marketplace" },
    { label: "Winkelmandje", href: "/dashboard/cart" },
    { label: "Mijn orders", href: "/dashboard/orders" },
    { label: "Mijn links", href: "/dashboard/links" },
    { label: "Projecten", href: "/dashboard/projects" },
    { label: "Facturen", href: "/dashboard/invoices" },
  ];

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl text-ink mb-1">Dashboard</h1>
          <p className="text-sm text-inkSoft">Welkom terug, {session!.user.companyName}</p>
        </div>
        <Link
          href="/marketplace"
          className="btn-primary rounded-md px-4 py-2 text-sm font-medium transition whitespace-nowrap"
        >
          + Nieuwe link bestellen
        </Link>
      </div>

      <h2 className="font-serif text-lg text-ink mb-3">Snel naar</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
        {shortcuts.map((shortcut) => (
          <Link
            key={shortcut.label}
            href={shortcut.href}
            className="bg-surface border border-line rounded-lg px-4 py-3 text-sm font-medium text-ink hover:border-brand hover:bg-brandSoft/30 transition-colors flex items-center justify-between"
          >
            {shortcut.label}
            <span className="text-inkSoft">→</span>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {tiles.map((tile) => (
          <Link
            key={tile.label}
            href={tile.href}
            className="bg-surface border border-line rounded-lg p-4 hover:border-brand transition-colors group"
          >
            <div className="text-xs text-inkSoft mb-1">{tile.label}</div>
            <div className="font-serif text-2xl text-ink mb-2">{tile.value}</div>
            <div className="text-xs text-brand group-hover:underline">{tile.cta} →</div>
          </Link>
        ))}
        <Link
          href="/dashboard/orders"
          className="bg-surface border border-line rounded-lg p-4 hover:border-brand transition-colors group"
        >
          <div className="text-xs text-inkSoft mb-1">Totaal aantal orders</div>
          <div className="font-serif text-2xl text-ink mb-2">{orderCount}</div>
          <div className="text-xs text-brand group-hover:underline">Bekijk orders →</div>
        </Link>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="font-serif text-lg text-ink">Recente orders</h2>
        <Link href="/dashboard/orders" className="text-sm text-brand hover:underline">
          Alle orders bekijken
        </Link>
      </div>
      <div className="bg-surface border border-line rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-brandSoft/50 text-inkSoft text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Order</th>
              <th className="px-4 py-2 font-medium">Website(s)</th>
              <th className="px-4 py-2 font-medium">Datum</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {recentOrders.map((order) => (
              <tr key={order.id} className="border-t border-line">
                <td className="px-4 py-3 text-ink font-medium">#{order.orderNumber}</td>
                <td className="px-4 py-3 text-inkSoft">
                  {order.items.map((i) => i.websiteProduct.website.domain).join(", ")}
                </td>
                <td className="px-4 py-3 text-inkSoft">{order.createdAt.toLocaleDateString("nl-NL")}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={order.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/dashboard/orders/${order.id}`} className="text-brand text-sm hover:underline">
                    Bekijken
                  </Link>
                </td>
              </tr>
            ))}
            {recentOrders.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-inkSoft">
                  Nog geen orders.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
