import { prisma } from "@/lib/prisma";

export default async function AdminCustomersPage() {
  const companies = await prisma.company.findMany({
    where: { type: "CUSTOMER" },
    include: { users: true, projects: true, _count: { select: { projects: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="font-serif text-2xl text-ink mb-1">Klanten</h1>
      <p className="text-sm text-inkSoft mb-6">{companies.length} klantbedrijf/bedrijven</p>

      <div className="bg-surface border border-line rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-brandSoft/50 text-inkSoft text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Bedrijf</th>
              <th className="px-4 py-2 font-medium">Gebruikers</th>
              <th className="px-4 py-2 font-medium">Projecten</th>
              <th className="px-4 py-2 font-medium">Aangemeld</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => (
              <tr key={c.id} className="border-t border-line">
                <td className="px-4 py-3 text-ink font-medium">{c.name}</td>
                <td className="px-4 py-3 text-inkSoft">{c.users.map((u) => u.email).join(", ") || "-"}</td>
                <td className="px-4 py-3 text-inkSoft">{c._count.projects}</td>
                <td className="px-4 py-3 text-inkSoft">{c.createdAt.toLocaleDateString("nl-NL")}</td>
              </tr>
            ))}
            {companies.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-inkSoft">
                  Nog geen klanten.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
