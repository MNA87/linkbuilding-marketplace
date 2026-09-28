"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ExternalLink } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import ClickableRow from "@/components/ClickableRow";
import type { AdminOrderRow } from "@/lib/adminOrders";
import { adminSetOrdersArchivedAction } from "./actions";

type Row = Omit<AdminOrderRow, "orderedAt"> & { day: string; time: string };

// Same layout as the customer's Mijn orders: the whole row opens the link;
// the checkbox and the live link sit above it.
const COLUMNS =
  "md:grid-cols-[18px_48px_150px_minmax(0,1.5fr)_minmax(0,1fr)_112px_150px_32px]";

// "Jouw actie": a yellow label when it's yours, grey words when it waits
// on someone else.
function NextStep({ next }: { next: NonNullable<Row["next"]> }) {
  return next.yours ? (
    <span className="inline-flex whitespace-nowrap rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">
      {next.label}
    </span>
  ) : (
    <span className="whitespace-nowrap text-xs text-inkSoft">{next.label}</span>
  );
}

export default function OrdersTable({ rows, archived, empty }: { rows: Row[]; archived: boolean; empty: string }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  // Archiving is per order: selecting a link selects its order.
  function toggle(orderId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }
  const orderIds = Array.from(new Set(rows.map((r) => r.orderId)));
  const allSelected = orderIds.length > 0 && orderIds.every((id) => selected.has(id));

  async function archive(archive: boolean) {
    setBusy(true);
    try {
      const result = await adminSetOrdersArchivedAction({ orderIds: Array.from(selected), archived: archive });
      if (result.success) {
        setSelected(new Set());
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4">
      {selected.size > 0 && (
        <div className="mb-2 flex items-center gap-3 px-1 text-sm">
          <span className="text-inkSoft">
            {selected.size === 1 ? "1 order geselecteerd" : `${selected.size} orders geselecteerd`}
          </span>
          <button
            type="button"
            onClick={() => archive(!archived)}
            disabled={busy}
            className="font-semibold text-[var(--btn-pay-bg)] hover:underline disabled:opacity-60"
          >
            {busy ? "Bezig..." : archived ? "Uit archief halen" : "Naar archief"}
          </button>
        </div>
      )}

      {/* Phone: the same columns as the computer, in a table to swipe
          sideways; the order number stays put. */}
      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-left text-xs font-medium text-inkSoft">
                {["Order", "Datum", "Website", "Klant", "Status", "Jouw actie", ""].map((h, i) => (
                  <th
                    key={i}
                    className={`whitespace-nowrap border-b border-line bg-gray-50 px-3.5 py-2.5 font-medium ${
                      i === 0 ? "sticky left-0 z-10 shadow-[1px_0_0_theme(colors.gray.200)]" : ""
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                // Yellow when it waits on you, like on the computer; solid, so
                // the order number column stays opaque over what slides under.
                const cell = `whitespace-nowrap border-b border-line/70 px-3.5 py-3 ${r.next?.yours ? "bg-[#fffcf2]" : ""}`;
                return (
                  <ClickableRow key={r.id} href={`/admin/orders/${r.id}`}>
                    <td className={`${cell} sticky left-0 z-10 ${r.next?.yours ? "" : "bg-surface"} tabular-nums text-ink shadow-[1px_0_0_theme(colors.gray.200)]`}>
                      <Link href={`/admin/orders/${r.id}`}>#{r.orderNumber}</Link>
                      {r.isTest && <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">TEST</span>}
                    </td>
                    <td className={`${cell} tabular-nums text-ink/80`}>
                      {r.day} <span className="text-inkSoft">{r.time}</span>
                    </td>
                    <td className={`${cell} font-semibold text-ink`}>
                      <Link href={`/admin/orders/${r.id}`}>{r.domain}</Link>
                      {r.liveUrl && (
                        <a href={r.liveUrl} target="_blank" rel="noreferrer" aria-label={`Live link op ${r.domain} bekijken`} className="ml-1.5 inline-block align-[-2px] text-inkSoft">
                          <ExternalLink size={13} />
                        </a>
                      )}
                    </td>
                    <td className={`${cell} text-ink/80`}>{r.customer}</td>
                    <td className={cell}>
                      <StatusBadge status={r.orderStatus} />
                    </td>
                    <td className={cell}>
                      {r.next ? <NextStep next={r.next} /> : <span className="text-inkSoft">–</span>}
                    </td>
                    <td className={cell}>
                      <Link href={`/admin/orders/${r.id}`} className="font-semibold text-[var(--btn-pay-bg)]">
                        Bekijk →
                      </Link>
                    </td>
                  </ClickableRow>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className={`overflow-hidden rounded-xl border border-line bg-surface ${rows.length > 0 ? "hidden md:block" : ""}`}>
        {rows.length > 0 && (
          <div className={`hidden md:grid ${COLUMNS} items-center gap-x-4 bg-gray-50 px-5 py-2.5 text-xs font-medium text-inkSoft`}>
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => setSelected(allSelected ? new Set() : new Set(orderIds))}
              aria-label="Alles selecteren"
            />
            <span>Order</span>
            <span>Datum</span>
            <span>Website</span>
            <span>Klant</span>
            <span>Status</span>
            <span>Jouw actie</span>
            <span className="text-right">Details</span>
          </div>
        )}

        {rows.map((r) => (
          <div
            key={r.id}
            className={`group relative grid grid-cols-[minmax(0,1fr)_auto] ${COLUMNS} items-center gap-x-4 gap-y-1 border-t border-line/70 px-4 py-3 transition-colors first:border-t-0 hover:bg-gray-50/70 sm:px-5 ${
              r.next?.yours ? "bg-amber-50/40" : ""
            }`}
          >
            <Link href={`/admin/orders/${r.id}`} className="absolute inset-0" aria-label={`Order ${r.orderNumber} · ${r.domain} bekijken`} />
            <input
              type="checkbox"
              checked={selected.has(r.orderId)}
              onChange={() => toggle(r.orderId)}
              aria-label={`Order ${r.orderNumber} selecteren`}
              className="relative z-10 hidden md:block"
            />
            <span className="text-sm tabular-nums text-ink">
              #{r.orderNumber}
              {r.isTest && (
                <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 md:ml-0 md:mt-0.5 md:block md:w-fit">
                  TEST
                </span>
              )}
            </span>
            <span className="hidden whitespace-nowrap text-sm tabular-nums text-ink/80 md:block">
              {r.day} <span className="text-inkSoft">{r.time}</span>
            </span>
            <div className="col-span-2 row-start-2 min-w-0 md:col-span-1 md:row-start-auto">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-sm text-ink">{r.domain}</span>
                {r.liveUrl && (
                  <a
                    href={r.liveUrl}
                    target="_blank"
                    rel="noreferrer"
                    title="Bekijk de live link"
                    aria-label={`Live link op ${r.domain} bekijken`}
                    className="relative z-10 shrink-0 rounded p-0.5 text-inkSoft hover:bg-gray-100 hover:text-[var(--btn-pay-bg)]"
                  >
                    <ExternalLink size={14} />
                  </a>
                )}
              </span>
              <span className="block truncate text-xs text-inkSoft">{r.details}</span>
            </div>
            <span className="hidden truncate text-sm text-ink/80 md:block">{r.customer}</span>
            <span className="col-start-2 row-start-1 justify-self-end md:col-start-auto md:row-start-auto md:justify-self-start">
              <StatusBadge status={r.orderStatus} className="inline-flex w-[112px]" />
            </span>
            <span className="col-span-2 md:col-span-1">
              {r.next ? (
                <NextStep next={r.next} />
              ) : (
                <span className="hidden text-sm text-inkSoft md:inline">–</span>
              )}
            </span>
            <span className="hidden justify-self-end md:block">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-inkSoft transition-colors group-hover:bg-[var(--btn-pay-bg)] group-hover:text-white">
                <ChevronRight size={16} />
              </span>
            </span>
          </div>
        ))}

        {rows.length === 0 && <div className="px-5 py-10 text-center text-sm text-inkSoft">{empty}</div>}
      </div>
    </div>
  );
}
