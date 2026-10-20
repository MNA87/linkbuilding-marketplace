import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronRight, ExternalLink, Folder } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { itemPrice } from "@/lib/writingService";
import { isAwaitingContent } from "@/lib/awaitingContent";
import { STAGE_STYLES, linkStatus } from "@/lib/customerOrders";

export const metadata: Metadata = { title: "Project" };

const euro = (n: number) => `€${n.toFixed(2).replace(".", ",")}`;
const orderDay = (d: Date) =>
  d.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Amsterdam" });

// Projectdetail: alle plaatsingen (de agency-klant/campagne is een label per
// regel, OrderItem.projectId) met hun status, besteldatum, prijs en een link
// naar de order. Zo kun je doorklikken vanuit Projecten of de orders-filter.
export default async function CustomerProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer" || !session.user.companyId) redirect("/login");
  const { id } = await params;

  const project = await prisma.project.findFirst({
    where: { id, customerCompanyId: session.user.companyId },
  });
  if (!project) notFound();

  const items = await prisma.orderItem.findMany({
    where: {
      projectId: id,
      renewsOrderItemId: null,
      order: { customerId: session.user.id, status: { not: "NEW" } },
    },
    include: {
      websiteProduct: { include: { website: true, product: true } },
      placement: true,
      order: true,
    },
    orderBy: { id: "desc" },
  });

  const now = new Date();
  const rows = items.map((item) => ({
    item,
    status: linkStatus(
      {
        ...item,
        orderStatus: item.order.status,
        periodic: item.periodic,
        needsContent: isAwaitingContent(item, item.order.status, item.websiteProduct.product.type),
      },
      now
    ),
  }));
  const total = items.reduce((sum, i) => sum + itemPrice(i).toNumber(), 0);

  return (
    <div className="max-w-5xl">
      <Link
        href="/dashboard/projects"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-inkSoft transition-colors hover:text-ink"
      >
        <ArrowLeft size={15} /> Projecten
      </Link>

      <div className="mb-1 flex items-center gap-2">
        <Folder size={20} className="shrink-0 text-[var(--btn-pay-bg)]" />
        <h1 className="font-serif text-2xl text-ink sm:text-3xl">{project.name}</h1>
      </div>
      {project.targetWebsite && <p className="text-sm text-inkSoft">{project.targetWebsite}</p>}
      {project.notes && <p className="mt-1 max-w-2xl text-sm text-inkSoft">{project.notes}</p>}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-[var(--pay-soft)] px-4 py-3">
        <span className="text-sm text-ink">
          {items.length} {items.length === 1 ? "plaatsing" : "plaatsingen"} in dit project
        </span>
        <span className="inline-flex items-baseline gap-2">
          <span className="text-xs text-inkSoft">totaal</span>
          <span className="font-serif text-lg font-extrabold tabular-nums text-ink">{euro(total)}</span>
        </span>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-line bg-surface">
        {rows.length > 0 && (
          <div className="hidden grid-cols-[minmax(0,1fr)_180px_150px_110px_44px] gap-x-4 bg-gray-50 px-5 py-2.5 text-xs font-medium text-inkSoft sm:grid">
            <span>Website</span>
            <span>Status</span>
            <span>Besteld</span>
            <span className="text-right">Prijs</span>
            <span />
          </div>
        )}

        {rows.map(({ item, status }) => {
          const href = `/dashboard/orders/${item.orderId}`;
          const domain = item.websiteProduct.website.domain;
          return (
            <div
              key={item.id}
              className="group relative grid grid-cols-1 items-center gap-x-4 gap-y-2 border-t border-line/70 px-4 py-3.5 transition-colors first:border-t-0 hover:bg-gray-50/70 sm:grid-cols-[minmax(0,1fr)_180px_150px_110px_44px] sm:px-5"
            >
              <Link href={href} className="absolute inset-0" aria-label={`Order ${item.order.orderNumber} bekijken`} />
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="truncate font-medium text-ink">{domain}</span>
                <a
                  href={`https://${domain}`}
                  target="_blank"
                  rel="noreferrer"
                  className="relative z-10 shrink-0 text-inkSoft/60 hover:text-ink"
                  aria-label={`Open ${domain}`}
                >
                  <ExternalLink size={13} />
                </a>
                <span className="text-xs text-inkSoft">· #{item.order.orderNumber}</span>
              </div>
              <div>
                <span
                  className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${STAGE_STYLES[status.stage]}`}
                >
                  {status.label}
                </span>
              </div>
              <span className="text-sm tabular-nums text-ink/80">{orderDay(item.order.paidAt ?? item.order.createdAt)}</span>
              <span className="text-sm tabular-nums text-ink/80 sm:text-right">{euro(itemPrice(item).toNumber())}</span>
              <span className="hidden justify-self-end sm:block">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-inkSoft transition-colors group-hover:bg-[var(--btn-pay-bg)] group-hover:text-white">
                  <ChevronRight size={16} />
                </span>
              </span>
            </div>
          );
        })}

        {rows.length === 0 && (
          <div className="px-5 py-10 text-center text-sm text-inkSoft">
            Nog geen plaatsingen onder dit project. Koppel een project aan een plaatsing in de{" "}
            <Link href="/dashboard/marketplace" className="text-brand hover:underline">
              Marketplace
            </Link>
            .
          </div>
        )}
      </div>
    </div>
  );
}
