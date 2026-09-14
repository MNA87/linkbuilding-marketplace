import { prisma } from "@/lib/prisma";
import StatusBadge from "@/components/StatusBadge";

export default async function AdminOrdersPage() {
  const orders = await prisma.order.findMany({
    where: { status: { not: "NEW" } },
    include: {
      customer: { include: { company: true } },
      items: { include: { websiteProduct: { include: { website: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <h1 className="font-serif text-2xl text-ink mb-1">Orders</h1>
      <p className="text-sm text-inkSoft mb-6">{orders.length} meest recente orders</p>

      <div className="bg-surface border border-line rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-brandSoft/50 text-inkSoft text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Datum</th>
              <th className="px-4 py-2 font-medium">Klant</th>
              <th className="px-4 py-2 font-medium">Website(s)</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Bedrag</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-t border-line">
                <td className="px-4 py-3 text-inkSoft">{order.createdAt.toLocaleDateString("nl-NL")}</td>
                <td className="px-4 py-3 text-ink">{order.customer.company?.name ?? order.customer.name}</td>
                <td className="px-4 py-3 text-inkSoft">
                  {order.items.map((i) => i.websiteProduct.website.domain).join(", ")}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={order.status} />
                </td>
                <td className="px-4 py-3 text-ink font-medium">
                  &euro;{order.items.reduce((sum, i) => sum + i.customerPriceSnap.toNumber(), 0).toFixed(2)}
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
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
