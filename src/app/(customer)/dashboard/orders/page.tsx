import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function CustomerOrdersPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer") redirect("/login");

  const orders = await prisma.order.findMany({
    where: { customerId: session.user.id },
    include: { items: { include: { websiteProduct: { include: { website: true } } } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="font-serif text-2xl text-ink mb-1">Mijn orders</h1>
      <p className="text-sm text-inkSoft mb-6">{orders.length} order(s).</p>

      <div className="bg-surface border border-line rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-brandSoft/50 text-inkSoft text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Datum</th>
              <th className="px-4 py-2 font-medium">Website(s)</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Bedrag</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-t border-line">
                <td className="px-4 py-3 text-inkSoft">{order.createdAt.toLocaleDateString("nl-NL")}</td>
                <td className="px-4 py-3 text-ink">
                  {order.items.map((i) => i.websiteProduct.website.domain).join(", ")}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={order.status} />
                </td>
                <td className="px-4 py-3 text-ink font-medium">
                  &euro;{order.items.reduce((sum, i) => sum + i.customerPriceSnap.toNumber(), 0).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/dashboard/orders/${order.id}`} className="text-brand text-sm hover:underline">
                    Bekijken
                  </Link>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-inkSoft">
                  Nog geen orders.{" "}
                  <Link href="/marketplace" className="text-brand hover:underline">
                    Bekijk de marketplace
                  </Link>
                  .
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    NEW: "bg-gray-100 text-gray-700",
    PAID: "bg-blue-100 text-blue-700",
    SENT_TO_PUBLISHER: "bg-blue-100 text-blue-700",
    ACCEPTED: "bg-blue-100 text-blue-700",
    IN_PROGRESS: "bg-amber-100 text-amber-700",
    PUBLISHED: "bg-green-100 text-green-700",
    VERIFICATION: "bg-amber-100 text-amber-700",
    COMPLETED: "bg-green-100 text-green-700",
    REJECTED: "bg-red-100 text-red-700",
    CANCELLED: "bg-red-100 text-red-700",
    REFUND_REQUESTED: "bg-red-100 text-red-700",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] ?? "bg-gray-100 text-gray-700"}`}>
      {status}
    </span>
  );
}
