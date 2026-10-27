import Link from "next/link";
import { ChevronRight, Folder } from "lucide-react";
import ClickableRow from "@/components/ClickableRow";
import { STAGE_TONE, type LinkStage } from "@/lib/customerOrders";

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
  stageClass: string;
  dateLabel: string;
  amountLabel: string;
  unread: number;
  liveUrl: string | null;
  plannedLabel: string | null;
  needsContent: boolean;
};

// Mijn orders — Voorstel B. Rustige status: een stip + gekleurd woord, met een
// dun accent-balkje links van de rij/kaart. Project als mapje-pil. Geen losse
// knoppen: de hele rij/kaart opent de order (chevron als hint). Op mobiel
// gestapelde kaartjes.
const TH = "bg-gray-50 px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-inkSoft whitespace-nowrap";
const THR = `${TH} text-right`;
const TD = "px-3.5 py-3 align-middle";

function Status({ stage, label, planned }: { stage: LinkStage; label: string; planned: string | null }) {
  const t = STAGE_TONE[stage];
  return (
    <span className={`inline-flex items-center gap-2 whitespace-nowrap text-[13px] font-medium ${t.text}`}>
      <span className={`h-2 w-2 shrink-0 rounded-full ${t.dot}`} />
      {label}
      {planned && <span className="font-normal text-inkSoft">· {planned}</span>}
    </span>
  );
}

function Project({ name }: { name: string }) {
  if (name === "—") return <span className="text-gray-400">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-line px-2.5 py-0.5 text-xs text-ink">
      <Folder size={12} className="text-[var(--btn-pay-bg)]" />
      {name}
    </span>
  );
}

export default function OrdersList({ rows }: { rows: OrderRow[] }) {
  return (
    <>
      {/* Desktop: tabel. */}
      <div className="mt-4 hidden overflow-hidden rounded-xl border border-line bg-surface md:block">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className={`${TH} w-[7%]`}>Order</th>
              <th className={`${TH} w-[25%]`}>Site</th>
              <th className={`${TH} w-[17%]`}>Project</th>
              <th className={`${TH} w-[15%]`}>Datum</th>
              <th className={`${TH} w-[22%]`}>Status</th>
              <th className={`${THR} w-[10%]`}>Bedrag</th>
              <th className={`${TH} w-[4%]`} aria-hidden="true"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <ClickableRow key={r.id} href={r.href} className={`group border-t border-line/70 hover:bg-gray-50/60 ${r.needsContent ? "bg-amber-50/40" : ""}`}>
                <td className={`${TD} whitespace-nowrap border-l-[3px] tabular-nums text-ink ${STAGE_TONE[r.stage].bar}`}>#{r.orderNumber}</td>
                <td className={TD}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink">{r.domain}</span>
                    {r.extra > 0 && (
                      <span className="whitespace-nowrap rounded-md border border-line bg-gray-100 px-1.5 py-0.5 text-[11px] text-ink/70">+{r.extra}</span>
                    )}
                  </div>
                </td>
                <td className={TD}><Project name={r.project} /></td>
                <td className={`${TD} whitespace-nowrap text-[13px] text-inkSoft`}>{r.dateLabel}</td>
                <td className={TD}><Status stage={r.stage} label={r.stageLabel} planned={r.plannedLabel} /></td>
                <td className={`${TD} text-right tabular-nums text-[13px] text-inkSoft whitespace-nowrap`}>€{r.amountLabel}</td>
                <td className={`${TD} text-right`}>
                  <ChevronRight size={16} className="ml-auto text-gray-300 transition-colors group-hover:text-[var(--btn-pay-bg)]" />
                </td>
              </ClickableRow>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobiel: gestapelde kaartjes met accent-balkje links. */}
      <div className="mt-4 space-y-2.5 md:hidden">
        {rows.map((r) => (
          <Link
            key={r.id}
            href={r.href}
            className={`relative flex flex-col gap-2 overflow-hidden rounded-xl border p-3.5 pl-4 ${
              r.needsContent ? "border-amber-200 bg-amber-50/60" : "border-line bg-surface"
            }`}
          >
            <span className={`absolute inset-y-0 left-0 w-[3px] ${STAGE_TONE[r.stage].dot}`} aria-hidden="true" />
            <div className="flex items-baseline justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate font-semibold text-ink">{r.domain}</span>
                {r.extra > 0 && (
                  <span className="shrink-0 whitespace-nowrap rounded-md border border-line bg-gray-100 px-1.5 py-0.5 text-[11px] text-ink/70">+{r.extra}</span>
                )}
              </div>
              <span className="shrink-0 whitespace-nowrap text-[13px] tabular-nums text-inkSoft">€{r.amountLabel}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[11.5px] text-gray-400">
              <span>#{r.orderNumber} · {r.dateLabel}</span>
              {r.project !== "—" && <Project name={r.project} />}
            </div>
            <Status stage={r.stage} label={r.stageLabel} planned={r.plannedLabel} />
          </Link>
        ))}
      </div>
    </>
  );
}
