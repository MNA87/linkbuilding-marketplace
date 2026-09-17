"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { OrderStatus } from "@prisma/client";
import StatusBadge from "@/components/StatusBadge";
import { adminSetOrdersArchivedAction } from "./actions";

export type OrdersTableItem = {
  id: string;
  isTest: boolean;
  order: {
    id: string;
    orderNumber: number;
    status: OrderStatus;
    createdAt: Date;
    customerLabel: string;
  };
  domain: string;
  liveUrl: string | null;
  placementStatus: string | null;
};

export default function OrdersTable({ items, view }: { items: OrdersTableItem[]; view: "actief" | "archief" }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  function toggle(orderId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === items.length ? new Set() : new Set(items.map((i) => i.order.id))));
  }

  async function handleBulkArchive(archived: boolean) {
    setBusy(true);
    try {
      const result = await adminSetOrdersArchivedAction({ orderIds: Array.from(selected), archived });
      if (result.success) {
        setSelected(new Set());
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-2 px-1">
          <span className="text-sm text-inkSoft">{selected.size} geselecteerd</span>
          {view === "actief" ? (
            <button
              type="button"
              onClick={() => handleBulkArchive(true)}
              disabled={busy}
              className="text-sm text-brand hover:underline disabled:opacity-60"
            >
              {busy ? "Bezig..." : "Naar archief"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleBulkArchive(false)}
              disabled={busy}
              className="text-sm text-brand hover:underline disabled:opacity-60"
            >
              {busy ? "Bezig..." : "Uit archief halen"}
            </button>
          )}
        </div>
      )}

      <div className="bg-surface border border-line rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-brandSoft/50 text-inkSoft text-left">
            <tr>
              <th className="px-4 py-2 font-medium w-8">
                <input
                  type="checkbox"
                  checked={items.length > 0 && selected.size === items.length}
                  onChange={toggleAll}
                  aria-label="Alles selecteren"
                />
              </th>
              <th className="px-4 py-2 font-medium">#</th>
              <th className="px-4 py-2 font-medium">Website</th>
              <th className="px-4 py-2 font-medium">Klant</th>
              <th className="px-4 py-2 font-medium">Tijd</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Live</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-line hover:bg-brandSoft/20">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(item.order.id)}
                    onChange={() => toggle(item.order.id)}
                    aria-label={`Order #${item.order.orderNumber} selecteren`}
                  />
                </td>
                <td className="px-4 py-3 text-inkSoft">
                  <Link href={`/admin/orders/${item.id}`} className="text-brand hover:underline">
                    #{item.order.orderNumber}
                  </Link>
                  {item.isTest && (
                    <span className="ml-2 px-1.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                      TEST
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-ink font-medium">
                  <Link href={`/admin/orders/${item.id}`} className="hover:underline">
                    {item.domain}
                  </Link>
                </td>
                <td className="px-4 py-3 text-inkSoft">{item.order.customerLabel}</td>
                <td className="px-4 py-3 text-inkSoft whitespace-nowrap">
                  {item.order.createdAt.toLocaleString("nl-NL", {
                    dateStyle: "short",
                    timeStyle: "short",
                    timeZone: "Europe/Amsterdam",
                  })}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={item.order.status} />
                </td>
                <td className="px-4 py-3">
                  {item.liveUrl ? (
                    <a
                      href={item.liveUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-brand hover:underline"
                    >
                      Live
                    </a>
                  ) : item.placementStatus === "draft" ? (
                    <span className="text-amber-700">Concept</span>
                  ) : (
                    <span className="text-inkSoft">&mdash;</span>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-inkSoft">
                  {view === "archief" ? "Nog geen gearchiveerde orders." : "Nog geen actieve orders."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
