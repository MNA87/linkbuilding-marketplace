import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { invoicePeriod } from "@/lib/invoicePeriod";

export const metadata: Metadata = { title: "Facturen" };

export default async function AdminInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ jaar?: string; kwartaal?: string }>;
}) {
  const { jaar, kwartaal } = await searchParams;
  const period = invoicePeriod(jaar, kwartaal);
  const invoices = await prisma.invoice.findMany({
    where: { issuedAt: { gte: period.from, lt: period.to } },
    include: { customerCompany: true, order: { select: { orderNumber: true } } },
    orderBy: { issuedAt: "asc" },
  });

  const sum = (pick: (i: (typeof invoices)[number]) => number) => invoices.reduce((s, i) => s + pick(i), 0);
  const totals = {
    subtotal: sum((i) => i.subtotal.toNumber()),
    vat: sum((i) => i.vatAmount.toNumber()),
    amount: sum((i) => i.amount.toNumber()),
  };
  const periodHref = (q: number | null, y = period.year) => `/admin/invoices?jaar=${y}${q ? `&kwartaal=${q}` : ""}`;
  const tab = (active: boolean) =>
    `px-3 py-1.5 rounded-md text-sm ${active ? "bg-brand text-white" : "text-inkSoft hover:bg-brandSoft hover:text-ink"}`;

  return (
    <div>
      <h1 className="font-serif text-2xl text-ink mb-1">Facturen</h1>
      <p className="text-sm text-inkSoft mb-4">
        Alle facturen en creditfacturen per periode — de totalen zijn wat je voor de BTW-aangifte nodig hebt.
      </p>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Link href={periodHref(period.quarter, period.year - 1)} className={tab(false)}>
          &larr; {period.year - 1}
        </Link>
        <Link href={periodHref(null)} className={tab(period.quarter === null)}>
          Heel {period.year}
        </Link>
        {[1, 2, 3, 4].map((q) => (
          <Link key={q} href={periodHref(q)} className={tab(period.quarter === q)}>
            Q{q}
          </Link>
        ))}
        <Link href={periodHref(period.quarter, period.year + 1)} className={tab(false)}>
          {period.year + 1} &rarr;
        </Link>
        <a
          href={`/api/admin/invoices/csv?jaar=${period.year}${period.quarter ? `&kwartaal=${period.quarter}` : ""}`}
          className="ml-auto text-sm text-brand hover:underline"
        >
          Download als CSV
        </a>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {[
          ["Omzet excl. BTW", totals.subtotal],
          ["BTW", totals.vat],
          ["Totaal incl. BTW", totals.amount],
        ].map(([label, value]) => (
          <div key={label as string} className="bg-surface border border-line rounded-lg p-4">
            <div className="text-xs text-inkSoft mb-1">
              {label} — {period.label}
            </div>
            <div className="font-serif text-2xl text-ink">&euro;{(value as number).toFixed(2)}</div>
          </div>
        ))}
      </div>

      <div className="bg-surface border border-line rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-brandSoft/50 text-inkSoft text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Nummer</th>
              <th className="px-4 py-2 font-medium">Datum</th>
              <th className="px-4 py-2 font-medium">Klant</th>
              <th className="px-4 py-2 font-medium">Order</th>
              <th className="px-4 py-2 font-medium text-right">Excl. BTW</th>
              <th className="px-4 py-2 font-medium text-right">BTW</th>
              <th className="px-4 py-2 font-medium text-right">Incl. BTW</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-t border-line">
                <td className="px-4 py-3 text-ink font-medium whitespace-nowrap">
                  {inv.invoiceNumber}
                  {inv.type === "CREDIT" && <span className="ml-2 text-xs font-normal text-inkSoft">credit</span>}
                </td>
                <td className="px-4 py-3 text-inkSoft">{inv.issuedAt.toLocaleDateString("nl-NL")}</td>
                <td className="px-4 py-3 text-ink">{inv.customerCompany.name}</td>
                <td className="px-4 py-3 text-inkSoft">#{inv.order.orderNumber}</td>
                <td className="px-4 py-3 text-right">&euro;{inv.subtotal.toFixed(2)}</td>
                <td className="px-4 py-3 text-right">&euro;{inv.vatAmount.toFixed(2)}</td>
                <td className="px-4 py-3 text-right font-medium">&euro;{inv.amount.toFixed(2)}</td>
                <td className="px-4 py-3 text-right">
                  <a href={`/api/invoices/${inv.id}/pdf`} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                    PDF
                  </a>
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-inkSoft">
                  Geen facturen in {period.label}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
