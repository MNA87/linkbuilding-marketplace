import Link from "next/link";
import { ChevronRight, FileText, House } from "lucide-react";

export type OrderRow = {
  id: string;
  orderNumber: number;
  href: string;
  kind: "blog" | "homepage";
  domain: string;
  extra: number;
  stageLabel: string;
  stageClass: string;
  dateLabel: string;
  amountLabel: string;
  unread: number;
};

// Mijn orders: één klikbare kaart per order. De hele kaart opent de order —
// geen archiveren of selecteren meer (dat is beheer-gedrag, geen klant-gedrag),
// dus de lijst blijft rustig en voorspelbaar.
export default function OrdersList({ rows }: { rows: OrderRow[] }) {
  return (
    <div className="mt-4 space-y-2.5">
      {rows.map((r) => {
        const Lead = r.kind === "homepage" ? House : FileText;
        return (
          <Link
            key={r.id}
            href={r.href}
            className="group flex items-center gap-3 rounded-xl border border-line bg-surface p-3 transition-colors hover:border-[var(--btn-pay-bg)] hover:bg-gray-50/60 sm:gap-3.5 sm:p-3.5"
          >
            {/* Lead-icoon (blog / homepage). */}
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-gray-50 text-inkSoft">
              <Lead size={17} strokeWidth={1.8} />
            </span>

            {/* Midden: domein + ordernummer, status + datum/reactie. */}
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-semibold text-ink">{r.domain}</span>
                <span className="shrink-0 text-xs text-gray-400 tabular-nums">#{r.orderNumber}</span>
                {r.extra > 0 && (
                  <span className="shrink-0 whitespace-nowrap rounded-md border border-line bg-gray-100 px-1.5 py-0.5 text-[11px] text-ink/70">
                    +{r.extra}
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${r.stageClass}`}>
                  {r.stageLabel}
                </span>
                {r.unread > 0 ? (
                  <span className="text-xs font-semibold text-brand">
                    {r.unread === 1 ? "1 nieuwe reactie" : `${r.unread} nieuwe reacties`}
                  </span>
                ) : (
                  <span className="text-xs text-inkSoft">{r.dateLabel}</span>
                )}
              </div>
            </div>

            {/* Rechts: bedrag + chevron. */}
            <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
              <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-ink">€{r.amountLabel}</span>
              <span className="hidden h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-inkSoft transition-colors group-hover:bg-[var(--btn-pay-bg)] group-hover:text-white sm:flex">
                <ChevronRight size={16} />
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
