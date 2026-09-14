import { prisma } from "@/lib/prisma";

export default async function AdminDashboardPage() {
  const [websiteCount, orderCount, pendingWebsites] = await Promise.all([
    prisma.website.count(),
    prisma.order.count({ where: { status: { not: "NEW" } } }),
    prisma.website.count({ where: { status: "SUBMITTED" } }),
  ]);

  return (
    <div>
      <h1 className="font-serif text-2xl text-ink mb-1">Platformoverzicht</h1>
      <p className="text-sm text-inkSoft mb-6">Alle cijfers rechtstreeks uit de database.</p>
      <div className="flex gap-4 flex-wrap">
        <Stat label="Websites" value={websiteCount} />
        <Stat label="Orders" value={orderCount} />
        <Stat label="Ter beoordeling" value={pendingWebsites} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-surface border border-line rounded-lg p-4 min-w-[140px]">
      <div className="text-xs text-inkSoft mb-1">{label}</div>
      <div className="font-serif text-2xl text-ink">{value}</div>
    </div>
  );
}
