import type { Metadata } from "next";
import Link from "next/link";
import { Prisma, OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { TEST_CUSTOMER_EMAIL } from "@/lib/testCustomer";
import StatusBadge from "@/components/StatusBadge";

export const metadata: Metadata = { title: "Orders" };

const PAGE_SIZE = 25;
const ARCHIVED_STATUSES: OrderStatus[] = ["COMPLETED", "REJECTED", "CANCELLED"];

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; page?: string }>;
}) {
  const { view: viewParam, page: pageParam } = await searchParams;
  const view = viewParam === "archief" ? "archief" : "actief";
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  const where: Prisma.OrderItemWhereInput = {
    order:
      view === "archief"
        ? { status: { in: ARCHIVED_STATUSES } }
        : { status: { notIn: ["NEW", ...ARCHIVED_STATUSES] } },
  };

  const [items, total] = await Promise.all([
    prisma.orderItem.findMany({
      where,
      include: {
        order: { include: { customer: { include: { company: true } } } },
        websiteProduct: { include: { website: true } },
        placement: true,
      },
      orderBy: { order: { createdAt: "desc" } },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.orderItem.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const tabClass = (active: boolean) =>
    `px-3 py-1.5 text-sm rounded-md ${active ? "bg-brand text-white" : "text-inkSoft hover:bg-brandSoft"}`;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-serif text-2xl text-ink">Orders</h1>
        <Link href="/admin/orders/test" className="text-sm text-brand hover:underline">
          + Testorder aanmaken
        </Link>
      </div>
      <p className="text-sm text-inkSoft mb-4">{total} order-item(s), meest recent eerst</p>

      <div className="flex gap-1 mb-4">
        <Link href="/admin/orders?view=actief" className={tabClass(view === "actief")}>
          Actief
        </Link>
        <Link href="/admin/orders?view=archief" className={tabClass(view === "archief")}>
          Archief
        </Link>
      </div>

      <div className="bg-surface border border-line rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-brandSoft/50 text-inkSoft text-left">
            <tr>
              <th className="px-4 py-2 font-medium">#</th>
              <th className="px-4 py-2 font-medium">Website</th>
              <th className="px-4 py-2 font-medium">Klant</th>
              <th className="px-4 py-2 font-medium">Tijd</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Live</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-line hover:bg-brandSoft/20">
                <td className="px-4 py-3 text-inkSoft">
                  <Link href={`/admin/orders/${item.id}`} className="text-brand hover:underline">
                    #{item.order.orderNumber}
                  </Link>
                  {item.order.customer.email === TEST_CUSTOMER_EMAIL && (
                    <span className="ml-2 px-1.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                      TEST
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-ink font-medium">
                  <Link href={`/admin/orders/${item.id}`} className="hover:underline">
                    {item.websiteProduct.website.domain}
                  </Link>
                </td>
                <td className="px-4 py-3 text-inkSoft">
                  {item.order.customer.company?.name ?? item.order.customer.name}
                </td>
                <td className="px-4 py-3 text-inkSoft whitespace-nowrap">
                  {item.order.createdAt.toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" })}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={item.order.status} />
                </td>
                <td className="px-4 py-3">
                  {item.placement?.liveUrl ? (
                    <a
                      href={item.placement.liveUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-brand hover:underline"
                    >
                      Live
                    </a>
                  ) : item.placement?.status === "draft" ? (
                    <span className="text-amber-700">Concept</span>
                  ) : (
                    <span className="text-inkSoft">&mdash;</span>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-inkSoft">
                  {view === "archief" ? "Nog geen afgeronde orders." : "Nog geen actieve orders."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <Link
            href={`/admin/orders?view=${view}&page=${Math.max(1, page - 1)}`}
            className={`text-brand hover:underline ${page <= 1 ? "opacity-40 pointer-events-none" : ""}`}
          >
            &larr; Vorige
          </Link>
          <span className="text-inkSoft">
            Pagina {page} van {totalPages}
          </span>
          <Link
            href={`/admin/orders?view=${view}&page=${Math.min(totalPages, page + 1)}`}
            className={`text-brand hover:underline ${page >= totalPages ? "opacity-40 pointer-events-none" : ""}`}
          >
            Volgende &rarr;
          </Link>
        </div>
      )}
    </div>
  );
}
