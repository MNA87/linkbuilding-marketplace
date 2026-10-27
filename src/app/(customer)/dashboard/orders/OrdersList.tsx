import Link from "next/link";
import ClickableRow from "@/components/ClickableRow";

export type OrderRow = {
  id: string;
  orderNumber: number;
  href: string;
  kind: "blog" | "homepage";
  domain: string;
  extra: number;
  project: string;
  stageLabel: string;
  stageClass: string;
  dateLabel: string;
  amountLabel: string;
  unread: number;
};

// Mijn orders. Op desktop een marktplaats-tabel (grijze kop, haarlijntjes, elk
// gegeven in een eigen kolom); op mobiel gestapelde kaartjes i.p.v. een brede
// tabel die je zijwaarts moet scrollen. De hele rij/kaart opent de order.
const TH = "bg-gray-50 px-3.5 py-2.5 text-left text-[11.5px] font-semibold text-ink whitespace-nowrap";
const THR = `${TH} text-right`;
const TD = "px-3.5 py-3 align-middle";
const TDR = "px-3.5 py-3 text-right align-middle tabular-nums text-ink whitespace-nowrap";
const BADGE = "inline-flex min-w-[150px] justify-center whitespace-nowrap rounded-full px-3 py-0.5 text-[11px] font-semibold";
const BADGE_M = "inline-flex whitespace-nowrap rounded-full px-3 py-0.5 text-[11px] font-semibold";

export default function OrdersList({ rows }: { rows: OrderRow[] }) {
  return (
    <>
      {/* Desktop: tabel. */}
      <div className="mt-4 hidden overflow-hidden rounded-xl border border-line bg-surface md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className={`${TH} w-[7%]`}>Order</th>
              <th className={`${TH} w-[17%]`}>Datum</th>
              <th className={`${TH} w-[27%]`}>Site</th>
              <th className={`${TH} w-[17%]`}>Project</th>
              <th className={`${TH} w-[20%]`}>Status</th>
              <th className={`${THR} w-[12%]`}>Bedrag</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <ClickableRow key={r.id} href={r.href} className="border-t border-line/70 hover:bg-gray-50/60">
                <td className={`${TD} whitespace-nowrap tabular-nums text-ink`}>#{r.orderNumber}</td>
                <td className={`${TD} whitespace-nowrap text-[13px] text-inkSoft`}>{r.dateLabel}</td>
                <td className={TD}>
                  <div className="flex items-center gap-2">
                    <span className="text-ink">{r.domain}</span>
                    {r.extra > 0 && (
                      <span className="whitespace-nowrap rounded-md border border-line bg-gray-100 px-1.5 py-0.5 text-[11px] text-ink/70">+{r.extra}</span>
                    )}
                  </div>
                </td>
                <td className={`${TD} whitespace-nowrap`}>
                  <span className={r.project === "—" ? "text-gray-400" : "text-ink"}>{r.project}</span>
                </td>
                <td className={TD}>
                  <span className={`${BADGE} ${r.stageClass}`}>{r.stageLabel}</span>
                  {r.unread > 0 && (
                    <span className="ml-2 inline-flex align-middle text-[11px] font-semibold text-[var(--btn-pay-bg)]">
                      {r.unread === 1 ? "1 reactie" : `${r.unread} reacties`}
                    </span>
                  )}
                </td>
                <td className={TDR}>€{r.amountLabel}</td>
              </ClickableRow>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobiel: gestapelde kaartjes. */}
      <div className="mt-4 space-y-2.5 md:hidden">
        {rows.map((r) => (
          <Link
            key={r.id}
            href={r.href}
            className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3.5 transition-colors active:bg-gray-50"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold text-ink">{r.domain}</span>
                  {r.extra > 0 && (
                    <span className="shrink-0 whitespace-nowrap rounded-md border border-line bg-gray-100 px-1.5 py-0.5 text-[11px] text-ink/70">+{r.extra}</span>
                  )}
                </div>
                <div className="mt-0.5 text-xs text-inkSoft">
                  #{r.orderNumber} · {r.dateLabel}
                  {r.project !== "—" && <> · {r.project}</>}
                </div>
              </div>
              <span className="shrink-0 whitespace-nowrap font-semibold tabular-nums text-ink">€{r.amountLabel}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`${BADGE_M} ${r.stageClass}`}>{r.stageLabel}</span>
              {r.unread > 0 && (
                <span className="text-xs font-semibold text-[var(--btn-pay-bg)]">
                  {r.unread === 1 ? "1 nieuwe reactie" : `${r.unread} nieuwe reacties`}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
