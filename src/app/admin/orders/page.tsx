import type { Metadata } from "next";
import Link from "next/link";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { placementDetails } from "@/lib/placementPeriod";
import { TEST_CUSTOMER_EMAIL } from "@/lib/testCustomer";
import OrdersTable, { type OrdersTableItem } from "./OrdersTable";

export const metadata: Metadata = { title: "Orders" };

const PAGE_SIZE = 25;

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
        ? { archivedAt: { not: null } }
        : { archivedAt: null, status: { not: "NEW" } },
  };

  const [items, total] = await Promise.all([
    prisma.orderItem.findMany({
      where,
      include: {
        order: { include: { customer: { include: { company: true } } } },
        websiteProduct: { include: { website: true, product: true } },
        placement: true,
      },
      orderBy: { order: { createdAt: "desc" } },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.orderItem.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const tableItems: OrdersTableItem[] = items.map((item) => ({
    id: item.id,
    isTest: item.order.customer.email === TEST_CUSTOMER_EMAIL,
    order: {
      id: item.order.id,
      orderNumber: item.order.orderNumber,
      status: item.order.status,
      createdAt: item.order.createdAt,
      customerLabel: item.order.customer.company?.name ?? item.order.customer.name,
    },
    domain: item.websiteProduct.website.domain,
    liveUrl: item.placement?.liveUrl ?? null,
    placementStatus: item.placement?.status ?? null,
    details: placementDetails(item),
    toWrite: item.writeForMe && !item.articleTitle && !item.placement,
    plannedFor:
      item.readyToPublish && !item.placement && item.publishAt && item.publishAt > new Date()
        ? item.publishAt.toLocaleDateString("nl-NL", { day: "numeric", month: "numeric", year: "2-digit", timeZone: "Europe/Amsterdam" })
        : null,
  }));

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

      <OrdersTable items={tableItems} view={view} />

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
