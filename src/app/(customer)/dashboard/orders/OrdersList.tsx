"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CheckSquare, ChevronRight, FileText, House, X } from "lucide-react";
import ArchiveButton from "./ArchiveButton";
import { setOrdersArchivedAction } from "./actions";

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
  archived: boolean;
};

// Kaartrijen voor "Mijn orders". Twee duidelijk gescheiden standen, zodat je
// nooit per ongeluk in de details belandt terwijl je wilde selecteren:
//   • normaal  — géén vinkjes; tik op een kaart opent de order.
//   • selecteren — vinkjes verschijnen; tik op een kaart vinkt 'm aan/uit en
//     opent niks. De archiveer-balk staat bovenaan.
// Op mobiel stapelen de kaarten vanzelf netjes.
export default function OrdersList({ rows, archief }: { rows: OrderRow[]; archief: boolean }) {
  const router = useRouter();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // De selecteer-stand verlaten en de selectie wissen.
  const stop = () => {
    setSelecting(false);
    setSelected(new Set());
    setError(false);
  };
  const count = selected.size;

  const runBulk = () => {
    setError(false);
    const ids = Array.from(selected);
    startTransition(async () => {
      const res = await setOrdersArchivedAction(ids, !archief).catch(() => null);
      if (!res || res.error) {
        setError(true);
        return;
      }
      stop();
      router.refresh();
    });
  };

  return (
    <div className="mt-4">
      {/* Werkbalk — normaal één "Selecteren"-knop, in selecteer-stand de
          archiveer-balk. */}
      {selecting ? (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--btn-pay-bg)] bg-[var(--pay-soft)] px-4 py-2.5">
          <span className="text-sm font-semibold text-[var(--btn-pay-bg)]">
            {count === 0 ? "Niks geselecteerd" : `${count} geselecteerd`}
          </span>
          <span className="flex-1" />
          <button
            type="button"
            onClick={runBulk}
            disabled={pending || count === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--btn-pay-bg)] px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
          >
            {archief ? "Terugzetten" : "Archiveren"}
          </button>
          <button
            type="button"
            onClick={stop}
            className="inline-flex items-center gap-1 text-sm font-medium text-inkSoft hover:text-ink"
          >
            <X size={14} />
            Klaar
          </button>
        </div>
      ) : (
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={() => setSelecting(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-gray-50"
          >
            <CheckSquare size={14} />
            Selecteren
          </button>
        </div>
      )}

      {error && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {archief ? "Terugzetten" : "Archiveren"} lukte niet — probeer het opnieuw.
        </p>
      )}

      <div className="space-y-2.5">
        {rows.map((r) => {
          const sel = selected.has(r.id);
          const Lead = r.kind === "homepage" ? House : FileText;
          return (
            <div
              key={r.id}
              onClick={selecting ? () => toggle(r.id) : undefined}
              className={`group relative flex items-center gap-3 rounded-xl border p-3 transition-colors sm:gap-3.5 sm:p-3.5 ${
                selecting ? "cursor-pointer" : ""
              } ${
                sel
                  ? "border-[var(--btn-pay-bg)] bg-[var(--pay-soft)]"
                  : "border-line bg-surface hover:bg-gray-50"
              }`}
            >
              {/* Normaal opent de hele kaart de order; in selecteer-stand niet. */}
              {!selecting && (
                <Link href={r.href} className="absolute inset-0" aria-label={`Order ${r.orderNumber} bekijken`} />
              )}

              {/* Selectievakje — alleen in selecteer-stand. */}
              {selecting && (
                <span
                  aria-hidden="true"
                  className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors ${
                    sel
                      ? "border-[var(--btn-pay-bg)] bg-[var(--btn-pay-bg)] text-white"
                      : "border-gray-300 bg-surface text-transparent"
                  }`}
                >
                  {sel && <Check size={12} strokeWidth={3} />}
                </span>
              )}

              {/* Lead-icoon (blog / homepage). */}
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-inkSoft">
                <Lead size={17} strokeWidth={1.8} />
              </span>

              {/* Midden: domein + ordernummer, status + datum/reactie. */}
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-semibold text-ink">{r.domain}</span>
                  <span className="shrink-0 text-xs text-inkSoft tabular-nums">#{r.orderNumber}</span>
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
                  {r.unread > 0 && !selecting ? (
                    <Link href={`${r.href}#reacties`} className="relative z-10 text-xs font-semibold text-brand hover:underline">
                      {r.unread === 1 ? "1 nieuwe reactie" : `${r.unread} nieuwe reacties`}
                    </Link>
                  ) : r.unread > 0 ? (
                    <span className="text-xs font-semibold text-brand">
                      {r.unread === 1 ? "1 nieuwe reactie" : `${r.unread} nieuwe reacties`}
                    </span>
                  ) : (
                    <span className="text-xs text-inkSoft">{r.dateLabel}</span>
                  )}
                </div>
              </div>

              {/* Rechts: bedrag + (normaal) archiveren en chevron. In
                  selecteer-stand verdwijnen die, zodat de rij rustig blijft. */}
              <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
                <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-ink">€{r.amountLabel}</span>
                {!selecting && (
                  <>
                    <ArchiveButton orderId={r.id} archived={r.archived} />
                    <span className="hidden h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-inkSoft transition-colors group-hover:bg-[var(--btn-pay-bg)] group-hover:text-white sm:flex">
                      <ChevronRight size={16} />
                    </span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
