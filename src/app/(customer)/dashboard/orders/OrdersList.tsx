import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
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
  liveUrl: string | null;
  plannedLabel: string | null;
  needsContent: boolean;
};

// Mijn orders. Desktop: marktplaats-tabel; mobiel: gestapelde kaartjes. In beide
// leidt de status/actie — het bedrag staat klein en rustig. Een order die op
// jouw inhoud wacht licht op en krijgt een directe "Lever aan"; een live link
// krijgt "bekijk ↗"; een ingeplande toont de verwachte online-datum.
const TH = "bg-gray-50 px-3.5 py-2.5 text-left text-[11.5px] font-semibold text-ink whitespace-nowrap";
const THR = `${TH} text-right`;
const TD = "px-3.5 py-3 align-middle";
const TDR = "px-3.5 py-3 text-right align-middle tabular-nums text-[13px] text-inkSoft whitespace-nowrap";
const BADGE = "inline-flex min-w-[150px] justify-center whitespace-nowrap rounded-full px-3 py-0.5 text-[11px] font-semibold";
const BADGE_M = "inline-flex whitespace-nowrap rounded-full px-3 py-0.5 text-[11px] font-semibold";
const DO = "inline-flex items-center gap-1 text-[12.5px] font-semibold text-[var(--btn-pay-bg)] hover:underline";
const DOPILL = "relative z-10 inline-flex items-center gap-1 rounded-full bg-[var(--btn-pay-bg)] px-3 py-1.5 text-xs font-semibold text-white";

export default function OrdersList({ rows }: { rows: OrderRow[] }) {
  return (
    <>
      {/* Desktop: tabel. */}
      <div className="mt-4 hidden overflow-hidden rounded-xl border border-line bg-surface md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className={`${TH} w-[7%]`}>Order</th>
              <th className={`${TH} w-[16%]`}>Datum</th>
              <th className={`${TH} w-[24%]`}>Site</th>
              <th className={`${TH} w-[16%]`}>Project</th>
              <th className={`${TH} w-[26%]`}>Status</th>
              <th className={`${THR} w-[11%]`}>Bedrag</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <ClickableRow key={r.id} href={r.href} className={`border-t border-line/70 hover:bg-gray-50/60 ${r.needsContent ? "bg-amber-50/40" : ""}`}>
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
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className={`${BADGE} ${r.stageClass}`}>{r.stageLabel}</span>
                    {r.needsContent ? (
                      <Link href={r.href} className={DO}>Lever aan <ArrowRight size={13} /></Link>
                    ) : r.liveUrl ? (
                      <a href={r.liveUrl} target="_blank" rel="noopener noreferrer" className={DO}>bekijk <ExternalLink size={12} /></a>
                    ) : r.plannedLabel ? (
                      <span className="text-xs text-inkSoft">{r.plannedLabel}</span>
                    ) : r.unread > 0 ? (
                      <span className="text-xs font-semibold text-[var(--btn-pay-bg)]">{r.unread === 1 ? "1 reactie" : `${r.unread} reacties`}</span>
                    ) : null}
                  </div>
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
          <div
            key={r.id}
            className={`relative flex flex-col gap-2 rounded-xl border p-3.5 ${
              r.needsContent ? "border-amber-200 bg-amber-50/60" : "border-line bg-surface"
            }`}
          >
            <Link href={r.href} className="absolute inset-0 rounded-xl" aria-label={`Order ${r.orderNumber} openen`} />
            <div className="flex items-baseline justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate font-semibold text-ink">{r.domain}</span>
                {r.extra > 0 && (
                  <span className="shrink-0 whitespace-nowrap rounded-md border border-line bg-gray-100 px-1.5 py-0.5 text-[11px] text-ink/70">+{r.extra}</span>
                )}
              </div>
              <span className="shrink-0 whitespace-nowrap text-[13px] tabular-nums text-inkSoft">€{r.amountLabel}</span>
            </div>
            <div className="text-[11.5px] text-gray-400">
              #{r.orderNumber} · {r.dateLabel}
              {r.project !== "—" && <> · {r.project}</>}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={`${BADGE_M} ${r.stageClass}`}>{r.stageLabel}</span>
              {r.needsContent ? (
                <Link href={r.href} className={DOPILL}>Lever aan <ArrowRight size={13} /></Link>
              ) : r.liveUrl ? (
                <a href={r.liveUrl} target="_blank" rel="noopener noreferrer" className={`relative z-10 ${DO}`}>bekijk <ExternalLink size={12} /></a>
              ) : r.plannedLabel ? (
                <span className="text-xs text-inkSoft">{r.plannedLabel}</span>
              ) : r.unread > 0 ? (
                <span className="text-xs font-semibold text-[var(--btn-pay-bg)]">{r.unread === 1 ? "1 nieuwe reactie" : `${r.unread} nieuwe reacties`}</span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
