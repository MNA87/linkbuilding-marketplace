import { prisma } from "@/lib/prisma";
import Link from "next/link";

const STATUS_LABELS: Record<string, string> = {
  SUBMITTED: "In beoordeling",
  APPROVED: "Goedgekeurd",
  ACTIVE: "Actief",
  PAUSED: "Gepauzeerd",
  REJECTED: "Afgewezen",
};

const STATUS_COLORS: Record<string, string> = {
  SUBMITTED: "bg-amber-100 text-amber-700",
  APPROVED: "bg-blue-100 text-blue-700",
  ACTIVE: "bg-green-100 text-green-700",
  PAUSED: "bg-gray-100 text-gray-700",
  REJECTED: "bg-red-100 text-red-700",
};

export default async function AdminWebsitesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;

  const websites = await prisma.website.findMany({
    where: status ? { status: status as never } : undefined,
    include: { company: true, category: true, metrics: { orderBy: { fetchedAt: "desc" }, take: 1 } },
    orderBy: { createdAt: "desc" },
  });

  const statuses = ["SUBMITTED", "APPROVED", "ACTIVE", "PAUSED", "REJECTED"];

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-serif text-2xl text-ink">Websites</h1>
        <Link
          href="/admin/websites/new"
          className="bg-brand text-white rounded-md px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          + Nieuwe website
        </Link>
      </div>
      <p className="text-sm text-inkSoft mb-6">{websites.length} website(s)</p>

      <div className="flex gap-2 mb-4">
        <Link
          href="/admin/websites"
          className={`text-xs px-3 py-1.5 rounded-full border ${!status ? "border-brand bg-brandSoft text-brand" : "border-line text-inkSoft"}`}
        >
          Alle
        </Link>
        {statuses.map((s) => (
          <Link
            key={s}
            href={`/admin/websites?status=${s}`}
            className={`text-xs px-3 py-1.5 rounded-full border ${status === s ? "border-brand bg-brandSoft text-brand" : "border-line text-inkSoft"}`}
          >
            {STATUS_LABELS[s]}
          </Link>
        ))}
      </div>

      <div className="bg-surface border border-line rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-brandSoft/50 text-inkSoft text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Domein</th>
              <th className="px-4 py-2 font-medium">Publisher</th>
              <th className="px-4 py-2 font-medium">Categorie</th>
              <th className="px-4 py-2 font-medium">DR</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {websites.map((w) => (
              <tr key={w.id} className="border-t border-line">
                <td className="px-4 py-3 text-ink font-medium">{w.domain}</td>
                <td className="px-4 py-3 text-inkSoft">{w.company.name}</td>
                <td className="px-4 py-3 text-inkSoft">{w.category.name}</td>
                <td className="px-4 py-3 text-inkSoft">{w.metrics[0]?.domainRating ?? "-"}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[w.status]}`}>
                    {STATUS_LABELS[w.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/websites/${w.id}`} className="text-brand text-sm hover:underline">
                    Beoordelen
                  </Link>
                </td>
              </tr>
            ))}
            {websites.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-inkSoft">
                  Geen websites gevonden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
