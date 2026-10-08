import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Pagination from "@/components/Pagination";
import { currentPage } from "@/lib/pagination";
import { periodLabel } from "@/lib/collectiveInvoices";

const PER_PAGE = 20;

export const metadata: Metadata = { title: "Facturen" };

export default async function CustomerInvoicesPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer" || !session.user.companyId) redirect("/login");

  const where = { customerCompanyId: session.user.companyId };
  const total = await prisma.invoice.count({ where });
  const page = currentPage((await searchParams).pagina, Math.ceil(total / PER_PAGE));
  const invoices = await prisma.invoice.findMany({
    where,
    orderBy: { issuedAt: "desc" },
    skip: (page - 1) * PER_PAGE,
    take: PER_PAGE,
  });

  return (
    <div>
      <h1 className="font-serif text-2xl text-ink mb-1">Facturen</h1>
      <p className="text-sm text-inkSoft mb-6">{total === 1 ? "1 factuur" : `${total} facturen`}</p>

      <div className="bg-surface border border-line rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-brandSoft/50 text-inkSoft text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Factuurnummer</th>
              <th className="px-4 py-2 font-medium">Datum</th>
              <th className="px-4 py-2 font-medium">Bedrag incl. BTW</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-t border-line">
                <td className="px-4 py-3 text-ink font-medium">
                  {inv.invoiceNumber}
                  {inv.type === "CREDIT" && (
                    <span className="ml-2 text-xs font-normal text-inkSoft">creditfactuur</span>
                  )}
                  {inv.period && (
                    <span className="block text-xs font-normal text-inkSoft">
                      Verzamelfactuur {periodLabel(inv.period)}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-inkSoft">{inv.issuedAt.toLocaleDateString("nl-NL")}</td>
                <td className="px-4 py-3 text-ink">&euro;{inv.amount.toFixed(2)}</td>
                <td className="px-4 py-3">
                  {/* A verzamelfactuur is paid by bank transfer, within 30 days. */}
                  {inv.period && !inv.paidAt && inv.dueAt ? (
                    <span
                      className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${
                        inv.dueAt < new Date() ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"
                      }`}
                    >
                      Betalen vóór {inv.dueAt.toLocaleDateString("nl-NL", { timeZone: "Europe/Amsterdam" })}
                    </span>
                  ) : inv.type === "CREDIT" ? (
                    <span className="text-xs text-inkSoft">Teruggestort</span>
                  ) : (
                    <span className="whitespace-nowrap rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      Betaald
                    </span>
                  )}
                </td>
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
                <td colSpan={5} className="px-4 py-8 text-center text-inkSoft">
                  Nog geen facturen. Facturen verschijnen hier zodra een order betaald is.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page}
        perPage={PER_PAGE}
        total={total}
        noun="facturen"
        href={(n) => (n > 1 ? `/dashboard/invoices?pagina=${n}` : "/dashboard/invoices")}
      />
    </div>
  );
}
