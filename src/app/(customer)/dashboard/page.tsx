import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function CustomerDashboardPage() {
  const session = await getServerSession(authOptions);
  const companyId = session!.user.companyId!;

  // Simpele telling om te bevestigen dat de database-verbinding + het
  // schema al werken — de echte dashboardwidgets komen in Fase 6/stap 7.
  const orderCount = await prisma.order.count({
    where: { customer: { companyId } },
  });

  return (
    <div>
      <h1 className="font-serif text-2xl text-ink mb-1">Dashboard</h1>
      <p className="text-sm text-inkSoft mb-6">Welkom terug, {session!.user.companyName}</p>
      <div className="bg-surface border border-line rounded-lg p-4 inline-block">
        <div className="text-xs text-inkSoft mb-1">Totaal aantal orders</div>
        <div className="font-serif text-2xl text-ink">{orderCount}</div>
      </div>
    </div>
  );
}
