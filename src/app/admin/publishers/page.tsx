import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Publishers" };

export default async function AdminPublishersPage() {
  const companies = await prisma.company.findMany({
    where: { type: "PUBLISHER" },
    include: { users: true, _count: { select: { websites: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="font-serif text-2xl text-ink mb-1">Publishers</h1>
      <p className="text-sm text-inkSoft mb-6">{companies.length} publisher(s)</p>

      <div className="bg-surface border border-line rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-brandSoft/50 text-inkSoft text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Bedrijf</th>
              <th className="px-4 py-2 font-medium">Gebruikers</th>
              <th className="px-4 py-2 font-medium">Websites</th>
              <th className="px-4 py-2 font-medium">Stripe</th>
              <th className="px-4 py-2 font-medium">Aangemeld</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => (
              <tr key={c.id} className="border-t border-line">
                <td className="px-4 py-3 text-ink font-medium">{c.name}</td>
                <td className="px-4 py-3 text-inkSoft">{c.users.map((u) => u.email).join(", ") || "-"}</td>
                <td className="px-4 py-3 text-inkSoft">{c._count.websites}</td>
                <td className="px-4 py-3">
                  {c.stripeAccountOnboarded ? (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                      Verbonden
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                      Niet verbonden
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-inkSoft">{c.createdAt.toLocaleDateString("nl-NL")}</td>
              </tr>
            ))}
            {companies.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-inkSoft">
                  Nog geen publishers.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
