import { prisma } from "@/lib/prisma";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  paid: "bg-green-100 text-green-700",
  expired: "bg-gray-100 text-gray-700",
  failed: "bg-red-100 text-red-700",
};

export default async function AdminFinancePage() {
  const payments = await prisma.payment.findMany({
    include: { order: { include: { customer: { include: { company: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const paidPayments = payments.filter((p) => p.status === "paid");
  const totalRevenue = paidPayments.reduce((sum, p) => sum + p.amount.toNumber(), 0);

  return (
    <div>
      <h1 className="font-serif text-2xl text-ink mb-1">Betalingen</h1>
      <p className="text-sm text-inkSoft mb-6">{payments.length} betaling(en)</p>

      <div className="bg-surface border border-line rounded-lg p-4 mb-6 inline-block">
        <div className="text-xs text-inkSoft mb-1">Totaal ontvangen (betaald)</div>
        <div className="font-serif text-2xl text-ink">&euro;{totalRevenue.toFixed(2)}</div>
      </div>

      <div className="bg-surface border border-line rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-brandSoft/50 text-inkSoft text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Datum</th>
              <th className="px-4 py-2 font-medium">Klant</th>
              <th className="px-4 py-2 font-medium">Bedrag</th>
              <th className="px-4 py-2 font-medium">Provider</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-t border-line">
                <td className="px-4 py-3 text-inkSoft">{p.createdAt.toLocaleDateString("nl-NL")}</td>
                <td className="px-4 py-3 text-ink">{p.order.customer.company?.name ?? p.order.customer.name}</td>
                <td className="px-4 py-3 text-ink font-medium">&euro;{p.amount.toFixed(2)}</td>
                <td className="px-4 py-3 text-inkSoft">{p.provider}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[p.status] ?? "bg-gray-100 text-gray-700"}`}>
                    {p.status}
                  </span>
                </td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-inkSoft">
                  Nog geen betalingen.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
