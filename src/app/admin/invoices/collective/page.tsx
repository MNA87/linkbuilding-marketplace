import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { euro } from "@/lib/vat";
import { invoiceCustomer } from "@/lib/invoices";
import { pendingCollectiveGroups, periodLabel, periodOver } from "@/lib/collectiveInvoices";
import { CreateButton, OpenInvoiceButtons, UndoPaidButton } from "./CollectiveButtons";

export const metadata: Metadata = { title: "Verzamelfacturen" };

const date = (d: Date) =>
  d.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Amsterdam" });
const days = (from: Date, to: Date) => Math.floor((to.getTime() - from.getTime()) / 86_400_000);

// Orders on account (by mail) per customer per month: check the concept,
// then make and send the invoice; follow up what's still open.
export default async function CollectiveInvoicesPage() {
  const now = new Date();
  const [groups, open, paid] = await Promise.all([
    pendingCollectiveGroups(),
    prisma.invoice.findMany({
      where: { period: { not: null }, paidAt: null },
      include: { customerCompany: true },
      orderBy: { issuedAt: "asc" },
    }),
    prisma.invoice.findMany({
      where: { period: { not: null }, paidAt: { not: null } },
      include: { customerCompany: true },
      orderBy: { paidAt: "desc" },
      take: 10,
    }),
  ]);

  return (
    <div className="max-w-6xl">
      <Link href="/admin/invoices" className="text-sm text-brand hover:underline">
        &larr; Facturen
      </Link>
      <h1 className="mt-2 font-serif text-2xl text-ink sm:text-3xl">Verzamelfacturen</h1>
      <p className="mt-1 text-sm text-inkSoft">
        Bestellingen op rekening (per mail) komen per klant per maand op één factuur. Bekijk het concept, en maak en
        verstuur de factuur. Betalen binnen 30 dagen.
      </p>

      <h2 className="mt-6 text-sm font-semibold text-ink">Klaar om te factureren</h2>
      <div className="mt-2 overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium text-inkSoft">
            <tr>
              <th className="px-4 py-2.5">Klant</th>
              <th className="px-3">Maand</th>
              <th className="px-3 text-right">Links</th>
              <th className="px-3 text-right">Excl. btw</th>
              <th className="px-3 text-right">Totaal</th>
              <th className="px-4" />
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.key} className="border-t border-line/70 align-middle">
                <td className="px-4 py-3">
                  <div className="font-medium text-ink">{g.companyName}</div>
                  <div className="text-xs text-inkSoft">
                    {g.orders.length === 1 ? "1 bestelling" : `${g.orders.length} bestellingen`}
                    {g.vatRate === 0 ? " · zonder btw" : ""}
                  </div>
                </td>
                <td className="px-3 text-ink">
                  {periodLabel(g.period)}
                  {!periodOver(g.period, now) && (
                    <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                      loopt nog
                    </span>
                  )}
                </td>
                <td className="px-3 text-right tabular-nums">{g.links}</td>
                <td className="px-3 text-right tabular-nums">{euro(g.subtotal)}</td>
                <td className="px-3 text-right font-semibold tabular-nums">{euro(g.total)}</td>
                <td className="px-4 py-3 text-right">
                  <span className="inline-flex flex-wrap items-center justify-end gap-2">
                    <a
                      href={`/api/admin/invoices/concept?key=${encodeURIComponent(g.key)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-ink hover:bg-gray-50"
                    >
                      Concept bekijken
                    </a>
                    <CreateButton groupKey={g.key} label={`${g.companyName} (${periodLabel(g.period)})`} />
                  </span>
                </td>
              </tr>
            ))}
            {groups.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-inkSoft">
                  Niets te factureren. Bestellingen op rekening verschijnen hier vanzelf.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mt-8 text-sm font-semibold text-ink">Nog niet betaald</h2>
      <div className="mt-2 overflow-hidden rounded-xl border border-line bg-surface text-sm">
        {open.map((inv) => {
          const late = inv.dueAt ? days(inv.dueAt, now) : 0;
          return (
            <div
              key={inv.id}
              className="flex flex-wrap items-center justify-between gap-3 border-t border-line/70 px-4 py-3 first:border-t-0"
            >
              <div>
                <a
                  href={`/api/invoices/${inv.id}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-ink hover:underline"
                >
                  {inv.invoiceNumber}
                </a>
                <span className="text-ink"> · {invoiceCustomer(inv).companyName}</span>
                <span className="text-inkSoft"> · {periodLabel(inv.period!)}</span>
                <div className="text-xs text-inkSoft">
                  Verstuurd {date(inv.issuedAt)}
                  {inv.reminderSentAt && ` · herinnerd ${date(inv.reminderSentAt)}`}
                </div>
              </div>
              <span className="flex flex-wrap items-center gap-3">
                <span className="font-semibold tabular-nums">{euro(inv.amount.toNumber())}</span>
                {inv.dueAt &&
                  (late > 0 ? (
                    <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
                      {late === 1 ? "1 dag te laat" : `${late} dagen te laat`}
                    </span>
                  ) : (
                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-ink/80">
                      vóór {date(inv.dueAt)}
                    </span>
                  ))}
                <OpenInvoiceButtons invoiceId={inv.id} />
              </span>
            </div>
          );
        })}
        {open.length === 0 && <div className="px-4 py-6 text-center text-inkSoft">Alles is betaald.</div>}
      </div>

      {paid.length > 0 && (
        <>
          <h2 className="mt-8 text-sm font-semibold text-ink">Laatst betaald</h2>
          <div className="mt-2 overflow-hidden rounded-xl border border-line bg-surface text-sm">
            {paid.map((inv) => (
              <div
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-3 border-t border-line/70 px-4 py-2.5 first:border-t-0"
              >
                <span>
                  <span className="font-medium text-ink">{inv.invoiceNumber}</span>
                  <span className="text-ink"> · {invoiceCustomer(inv).companyName}</span>
                  <span className="text-inkSoft"> · {periodLabel(inv.period!)}</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="tabular-nums">{euro(inv.amount.toNumber())}</span>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                    Betaald {date(inv.paidAt!)}
                  </span>
                  <UndoPaidButton invoiceId={inv.id} />
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
