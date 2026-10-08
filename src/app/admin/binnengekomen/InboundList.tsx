"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { setMailsStatusAction } from "./actions";

export type InboundRow = {
  id: string;
  who: string;
  time: string;
  requestLabel: string | null;
  subject: string;
  domain: string | null;
  delivered: string;
  statusLabel: string;
  statusStyle: string;
  isNew: boolean;
};

const COLUMNS = "md:grid-cols-[18px_minmax(0,1.2fr)_minmax(0,1.6fr)_130px_130px_140px_32px]";

// The mails in Binnengekomen; tick several to move them to the archive at
// once (test mails, spam), or back from it.
export default function InboundList({ rows, archive, empty }: { rows: InboundRow[]; archive: boolean; empty: string }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function move() {
    setBusy(true);
    try {
      await setMailsStatusAction(Array.from(selected), archive ? "new" : "ignored");
      setSelected(new Set());
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4">
      {selected.size > 0 && (
        <div className="mb-2 flex items-center gap-3 px-1 text-sm">
          <span className="text-inkSoft">
            {selected.size === 1 ? "1 mail geselecteerd" : `${selected.size} mails geselecteerd`}
          </span>
          <button
            type="button"
            onClick={move}
            disabled={busy}
            className="font-semibold text-[var(--btn-pay-bg)] hover:underline disabled:opacity-60"
          >
            {busy ? "Bezig..." : archive ? "Terugzetten naar Te doen" : "Naar archief"}
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {rows.length > 0 && (
          <div
            className={`hidden md:grid ${COLUMNS} items-center gap-x-4 bg-gray-50 px-5 py-2.5 text-xs font-medium text-inkSoft`}
          >
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
              aria-label="Alles selecteren"
            />
            <span>Van</span>
            <span>Onderwerp</span>
            <span>Website</span>
            <span>Aangeleverd</span>
            <span>Status</span>
            <span />
          </div>
        )}
        {rows.map((m) => (
          <div
            key={m.id}
            className={`group relative grid grid-cols-1 gap-x-4 gap-y-1 border-t border-line/70 px-4 py-3.5 first:border-t-0 hover:bg-gray-50/70 sm:px-5 md:items-center ${COLUMNS} ${
              m.isNew ? "bg-[#fffcf2]" : ""
            }`}
          >
            <Link
              href={`/admin/binnengekomen/${m.id}`}
              className="absolute inset-0"
              aria-label={`Mail ${m.subject} bekijken`}
            />
            <input
              type="checkbox"
              checked={selected.has(m.id)}
              onChange={() => toggle(m.id)}
              aria-label={`Mail ${m.subject} selecteren`}
              className="relative z-10 hidden md:block"
            />
            <div className="min-w-0">
              <div className="truncate text-ink">{m.who}</div>
              <div className="truncate text-xs text-inkSoft">{m.time}</div>
            </div>
            <span className="min-w-0 text-sm text-ink/80">
              {m.requestLabel && (
                <span className="mr-1.5 whitespace-nowrap rounded-md bg-gray-100 px-1.5 py-0.5 text-xs font-semibold text-ink/80">
                  Aanvraag {m.requestLabel}
                </span>
              )}
              <span className="truncate">{m.subject}</span>
            </span>
            <span className="text-sm text-ink/80">
              <span className="text-inkSoft md:hidden">Website: </span>
              {m.domain ?? "—"}
            </span>
            <span className="text-sm text-ink/80">{m.delivered}</span>
            <span>
              <span
                className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${m.statusStyle}`}
              >
                {m.statusLabel}
              </span>
            </span>
            <span className="hidden h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-inkSoft transition-colors group-hover:bg-[var(--btn-pay-bg)] group-hover:text-white md:flex">
              <ChevronRight size={16} />
            </span>
          </div>
        ))}
        {rows.length === 0 && <div className="px-5 py-10 text-center text-sm text-inkSoft">{empty}</div>}
      </div>
    </div>
  );
}
