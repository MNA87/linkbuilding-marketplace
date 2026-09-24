import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Facturen" };

export default async function CustomerInvoicesPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer" || !session.user.companyId) redirect("/login");

  const invoices = await prisma.invoice.findMany({
    where: { customerCompanyId: session.user.companyId },
    orderBy: { issuedAt: "desc" },
  });

  return (
    <div>
      <h1 className="font-serif text-2xl text-ink mb-1">Facturen</h1>
      <p className="text-sm text-inkSoft mb-6">{invoices.length} factu(u)r(en)</p>

      <div className="bg-surface border border-line rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-brandSoft/50 text-inkSoft text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Factuurnummer</th>
              <th className="px-4 py-2 font-medium">Datum</th>
              <th className="px-4 py-2 font-medium">Bedrag incl. BTW</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-t border-line">
                <td className="px-4 py-3 text-ink font-medium">
                  {inv.invoiceNumber}
                  {inv.type === "CREDIT" && <span className="ml-2 text-xs font-normal text-inkSoft">creditfactuur</span>}
                </td>
                <td className="px-4 py-3 text-inkSoft">{inv.issuedAt.toLocaleDateString("nl-NL")}</td>
                <td className="px-4 py-3 text-ink">&euro;{inv.amount.toFixed(2)}</td>
                <td className="px-4 py-3 text-right">
                  <a
                    href={`/api/invoices/${inv.id}/pdf`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand text-sm hover:underline"
                  >
                    PDF
                  </a>
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-inkSoft">
                  Nog geen facturen. Facturen verschijnen hier zodra een order betaald is.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
