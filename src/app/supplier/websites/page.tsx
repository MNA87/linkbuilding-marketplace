import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Mijn websites" };

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

export default async function SupplierWebsitesPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "supplier" || !session.user.companyId) redirect("/login");

  const websites = await prisma.website.findMany({
    where: { companyId: session.user.companyId },
    include: {
      category: true,
      metrics: { orderBy: { fetchedAt: "desc" }, take: 1 },
      websiteProducts: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl text-ink mb-1">Mijn websites</h1>
          <p className="text-sm text-inkSoft">{websites.length} website(s)</p>
        </div>
        <Link
          href="/supplier/websites/new"
          className="btn-primary rounded-md px-4 py-2 text-sm font-medium transition"
        >
          + Nieuwe website
        </Link>
      </div>

      <div className="bg-surface border border-line rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-brandSoft/50 text-inkSoft text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Domein</th>
              <th className="px-4 py-2 font-medium">Categorie</th>
              <th className="px-4 py-2 font-medium">DR</th>
              <th className="px-4 py-2 font-medium">Producten</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {websites.map((w) => (
              <tr key={w.id} className="border-t border-line">
                <td className="px-4 py-3 text-ink font-medium">{w.domain}</td>
                <td className="px-4 py-3 text-inkSoft">{w.category.name}</td>
                <td className="px-4 py-3 text-inkSoft">{w.metrics[0]?.domainRating ?? "-"}</td>
                <td className="px-4 py-3 text-inkSoft">{w.websiteProducts.length}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[w.status]}`}>
                    {STATUS_LABELS[w.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/supplier/websites/${w.id}`} className="text-brand text-sm hover:underline">
                    Beheren
                  </Link>
                </td>
              </tr>
            ))}
            {websites.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-inkSoft">
                  Nog geen websites toegevoegd.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
