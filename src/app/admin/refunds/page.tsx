import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import RefundActions from "./RefundActions";
import { vatTotals } from "@/lib/vat";
import { itemPrice } from "@/lib/writingService";

export const metadata: Metadata = { title: "Terugbetalingen" };

export default async function AdminRefundsPage() {
  const orders = await prisma.order.findMany({
    where: { status: "REFUND_REQUESTED" },
    include: {
      customer: { include: { company: true } },
      items: { include: { websiteProduct: { include: { website: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="font-serif text-2xl text-ink mb-1">Restitutieverzoeken</h1>
      <p className="text-sm text-inkSoft mb-6">{orders.length} openstaand verzoek(en)</p>

      <div className="space-y-3">
        {orders.map((order) => {
          const total = vatTotals(order.items.map(itemPrice), order.vatRate).total;
          return (
            <div key={order.id} className="bg-surface border border-line rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="font-medium text-ink">
                    {order.customer.company?.name ?? order.customer.name} &middot; &euro;{total.toFixed(2)}
                  </div>
                  <div className="text-sm text-inkSoft">
                    {order.items.map((i) => i.websiteProduct.website.domain).join(", ")}
                  </div>
                </div>
                <RefundActions orderId={order.id} />
              </div>
            </div>
          );
        })}
        {orders.length === 0 && (
          <div className="bg-surface border border-line rounded-lg p-8 text-center text-inkSoft text-sm">
            Geen openstaande restitutieverzoeken.
          </div>
        )}
      </div>
    </div>
  );
}
