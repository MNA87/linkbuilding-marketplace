import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Uitbetalingen" };

export default async function SupplierPayoutsPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "supplier" || !session.user.companyId) redirect("/login");

  const items = await prisma.orderItem.findMany({
    where: {
      websiteProduct: { website: { companyId: session.user.companyId } },
      order: { status: { not: "NEW" } },
    },
    include: { order: true, websiteProduct: { include: { website: true } } },
    orderBy: { order: { paidAt: "desc" } },
  });

  const total = items.reduce((sum, i) => sum + i.supplierPriceSnap.toNumber(), 0);

  return (
    <div>
      <h1 className="font-serif text-2xl text-ink mb-1">Uitbetalingen</h1>
      <p className="text-sm text-inkSoft mb-6">
        Uitbetalingen lopen automatisch via Stripe Connect zodra een order betaald wordt.
      </p>

      <div className="bg-surface border border-line rounded-lg p-4 mb-6 inline-block">
        <div className="text-xs text-inkSoft mb-1">Totaal ontvangen</div>
        <div className="font-serif text-2xl text-ink">&euro;{total.toFixed(2)}</div>
      </div>

      <div className="bg-surface border border-line rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-brandSoft/50 text-inkSoft text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Datum</th>
              <th className="px-4 py-2 font-medium">Website</th>
              <th className="px-4 py-2 font-medium">Jouw deel</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-line">
                <td className="px-4 py-3 text-inkSoft">
                  {item.order.paidAt?.toLocaleDateString("nl-NL") ?? "-"}
                </td>
                <td className="px-4 py-3 text-ink">{item.websiteProduct.website.domain}</td>
                <td className="px-4 py-3 text-ink font-medium">&euro;{item.supplierPriceSnap.toFixed(2)}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-inkSoft">
                  Nog geen uitbetalingen.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
