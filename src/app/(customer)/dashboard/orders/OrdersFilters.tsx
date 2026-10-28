"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { ORDER_SORTS } from "@/lib/customerOrders";

const KINDS = [
  { value: "", label: "Alle soorten" },
  { value: "blog", label: "Blogartikelen" },
  { value: "homepage", label: "Homepage links" },
];

// De "Filters"-knop (soort + sorteren) die naast de status-tabs staat. De
// popover opent rechts uitgelijnd en blijft binnen het scherm.
export default function OrdersFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const get = (key: string) => searchParams.get(key) ?? "";

  const apply = (changes: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("pagina");
    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const query = params.toString();
    router.push(query ? `/dashboard/orders?${query}` : "/dashboard/orders");
  };

  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const soort = get("soort");
  const sort = get("sort") || "nieuw";
  const activeCount = (soort ? 1 : 0) + (sort !== "nieuw" ? 1 : 0);
  const selectClass =
    "h-10 w-full appearance-none rounded-lg border border-line bg-surface pl-3 pr-9 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand";

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-sm font-medium transition-colors sm:gap-2 sm:px-3.5 ${
          open || activeCount > 0
            ? "border-[var(--btn-pay-bg)] bg-[var(--pay-soft)] text-[var(--btn-pay-bg)]"
            : "border-line bg-surface text-ink hover:bg-gray-50"
        }`}
      >
        <SlidersHorizontal size={15} />
        Filters
        {activeCount > 0 && (
          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--btn-pay-bg)] px-1 text-[11px] font-semibold text-white">
            {activeCount}
          </span>
        )}
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-[260px] max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-surface p-3 shadow-lg">
          <label className="mb-1 block text-xs font-semibold text-inkSoft">Soort</label>
          <div className="relative mb-3">
            <select value={soort} onChange={(e) => apply({ soort: e.target.value })} className={selectClass}>
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>{k.label}</option>
              ))}
            </select>
            <ChevronDown size={15} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-inkSoft" />
          </div>

          <label className="mb-1 block text-xs font-semibold text-inkSoft">Sorteren</label>
          <div className="relative">
            <select value={sort} onChange={(e) => apply({ sort: e.target.value === "nieuw" ? "" : e.target.value })} className={selectClass}>
              {ORDER_SORTS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown size={15} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-inkSoft" />
          </div>

          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => apply({ soort: "", sort: "" })}
              className="mt-3 w-full rounded-lg border border-line py-2 text-sm font-medium text-inkSoft hover:bg-gray-50"
            >
              Filters wissen
            </button>
          )}
        </div>
      )}
    </div>
  );
}
