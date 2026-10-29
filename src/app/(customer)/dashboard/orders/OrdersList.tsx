import Link from "next/link";
import { Calendar, Clock, ExternalLink, RefreshCw, Upload } from "lucide-react";
import ClickableRow from "@/components/ClickableRow";
import { STAGE_DOT, STAGE_PILL_NEUTRAL, type LinkStage } from "@/lib/customerOrders";

export type OrderRow = {
  id: string;
  orderNumber: number;
  href: string;
  kind: "blog" | "homepage";
  domain: string;
  extra: number;
  project: string;
  stage: LinkStage;
  stageLabel: string;
  dateLabel: string;
  amountLabel: string;
  unread: number;
  liveUrl: string | null;
  plannedLabel: string | null;
  needsContent: boolean;
};

// Mijn orders. Rustige marktplaats-basis (grijze kop, haarlijnen, chips), maar
// de actie leidt: alleen orders die iets van jou vragen krijgen een knop.
// Desktop: tabel met een aparte Actie-kolom (zoals "Voeg toe"); mobiel:
// gestapelde kaartjes met de actie onderin.
const TH = "bg-gray-50 px-3.5 py-2.5 text-left text-[12px] font-semibold text-ink whitespace-nowrap";
const THR = `${TH} text-right`;
const TD = "px-3.5 py-3 align-middle";
// Alle status-pills even breed (ook "Live"), zodat de kolom rustig oogt.
const PILL = "inline-flex min-w-[150px] items-center justify-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold";
// Rechter element: overal dezelfde grootte (gelijke lengte), rechts uitgelijnd.
const ACT = "relative z-10 inline-flex h-9 w-[150px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full text-xs";
const BTN = `${ACT} bg-[var(--btn-pay-bg)] font-semibold text-white transition hover:opacity-90`;
// Oranje: de actie die op de klant wacht ("Lever aan"), onderscheidt zich zo
// van de groene CTA's en matcht de amber "wacht op jouw inhoud"-status.
const BTN_WARN = `${ACT} bg-[#ea580c] font-semibold text-white transition hover:opacity-90`;
const BTN_GHOST = `${ACT} border-[1.5px] border-[var(--btn-pay-bg)] bg-surface font-semibold text-[var(--btn-pay-bg)] transition hover:bg-[var(--pay-soft)]`;
const CHIP = `${ACT} bg-gray-100 font-medium text-gray-500`;

function StatusPill({ stage, label }: { stage: LinkStage; label: string }) {
  return (
    <span className={`${PILL} gap-1.5 ${STAGE_PILL_NEUTRAL}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STAGE_DOT[stage]}`} />
      {label}
    </span>
  );
}

function Project({ name }: { name: string }) {
  return <span className={name === "—" ? "text-gray-400" : "text-ink"}>{name}</span>;
}

// De volgende stap voor deze order: inhoud aanleveren, verlengen, de live link
// bekijken, de verwachte online-datum, of niets.
function Action({ r }: { r: OrderRow }) {
  if (r.needsContent) {
    return <Link href={r.href} className={BTN_WARN}><Upload size={14} /> Lever aan</Link>;
  }
  if (r.stage === "verloopt") {
    return <Link href={r.href} className={BTN_GHOST}><RefreshCw size={14} /> Verleng</Link>;
  }
  if (r.stage === "live") {
    return r.liveUrl ? (
      <a href={r.liveUrl} target="_blank" rel="noopener noreferrer" className={BTN_GHOST}><ExternalLink size={13} /> Bekijk</a>
    ) : (
      <span className={CHIP}>online</span>
    );
  }
  if (r.stage === "ingepland") {
    return <span className={CHIP}><Calendar size={13} className="text-gray-400" /> {r.plannedLabel ? `online ${r.plannedLabel}` : "binnenkort"}</span>;
  }
  if (r.stage === "behandeling") {
    return <span className={CHIP}><Clock size={13} className="text-gray-400" /> wordt geplaatst</span>;
  }
  return null;
}

// Een live order opent meteen de site (nieuw tabblad); de rest opent de order.
function rowTarget(r: OrderRow): { href: string; newTab: boolean } {
  return r.stage === "live" && r.liveUrl ? { href: r.liveUrl, newTab: true } : { href: r.href, newTab: false };
}

export default function OrdersList({ rows }: { rows: OrderRow[] }) {
  return (
    <>
      {/* Desktop: tabel met aparte Actie-kolom. */}
      <div className="mt-4 hidden overflow-hidden rounded-xl border border-line bg-surface md:block">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className={`${TH} w-[7%]`}>Order</th>
              <th className={`${TH} w-[16%]`}>Datum</th>
              <th className={`${TH} w-[14%]`}>Site</th>
              <th className={`${TH} w-[18%]`}>Status</th>
              <th className={`${TH} w-[18%]`}>Project</th>
              <th className={`${THR} w-[9%]`}>Bedrag</th>
              <th className={`${TH} text-center w-[18%]`}>Actie</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const t = rowTarget(r);
              return (
              <ClickableRow key={r.id} href={t.href} newTab={t.newTab} className="border-t border-line/70 hover:bg-gray-50/60">
                <td className={`${TD} whitespace-nowrap tabular-nums text-ink`}>#{r.orderNumber}</td>
                <td className={`${TD} whitespace-nowrap text-[13px] text-inkSoft`}>{r.dateLabel}</td>
                <td className={TD}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink">{r.domain}</span>
                    {r.extra > 0 && (
                      <span className="whitespace-nowrap rounded-md border border-line bg-gray-100 px-1.5 py-0.5 text-[11px] text-ink/70">+{r.extra}</span>
                    )}
                  </div>
                </td>
                <td className={TD}><StatusPill stage={r.stage} label={r.stageLabel} /></td>
                <td className={TD}><Project name={r.project} /></td>
                <td className={`${TD} text-right tabular-nums text-[13px] text-inkSoft whitespace-nowrap`}>€{r.amountLabel}</td>
                <td className={`${TD} text-center`}><Action r={r} /></td>
              </ClickableRow>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobiel: gestapelde kaartjes met de actie onderin. */}
      <div className="mt-4 space-y-2.5 md:hidden">
        {rows.map((r) => {
          const t = rowTarget(r);
          return (
          <div key={r.id} className="relative flex flex-col gap-2 rounded-xl border border-line bg-surface p-3.5">
            {t.newTab ? (
              <a href={t.href} target="_blank" rel="noopener noreferrer" className="absolute inset-0 rounded-xl" aria-label={`${r.domain} openen`} />
            ) : (
              <Link href={t.href} className="absolute inset-0 rounded-xl" aria-label={`Order ${r.orderNumber} openen`} />
            )}
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
              #{r.orderNumber} · {r.dateLabel}{r.project !== "—" ? ` · ${r.project}` : ""}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center justify-between gap-2">
              <StatusPill stage={r.stage} label={r.stageLabel} />
              <Action r={r} />
            </div>
          </div>
          );
        })}
      </div>
    </>
  );
}
