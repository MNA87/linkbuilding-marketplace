"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Search, SlidersHorizontal } from "lucide-react";
import { ORDER_SORTS } from "@/lib/customerOrders";
import ProjectFilter from "./ProjectFilter";

const KINDS = [
  { value: "", label: "Alle soorten" },
  { value: "blog", label: "Blogartikelen" },
  { value: "homepage", label: "Homepage links" },
];

// De rustige filterregel van Mijn orders: zoeken, een project-dropdown (alleen
// bij bureaus met projecten) en één "Filters"-knop die soort + sorteren achter
// zich houdt — de statussen zitten in de segment-knop erboven.
export default function OrdersControls({
  projects,
  noneCount,
  projectValue,
}: {
  projects: { id: string; name: string; count: number }[];
  noneCount: number;
  projectValue: string;
}) {
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

  const search = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    apply({ q: String(new FormData(e.currentTarget).get("q") ?? "").trim() });
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
    <div className="mt-4 flex flex-wrap items-center gap-2.5">
      <form
        className="flex h-10 min-w-[200px] flex-1 overflow-hidden rounded-lg border border-line bg-surface focus-within:ring-2 focus-within:ring-[var(--btn-pay-bg)]"
        onSubmit={search}
      >
        <span className="flex items-center pl-3 text-inkSoft/80">
          <Search size={16} />
        </span>
        <input
          key={get("q")}
          name="q"
          type="search"
          aria-label="Zoek op website of ordernummer"
          defaultValue={get("q")}
          placeholder="Zoek op website of ordernummer"
          className="min-w-0 flex-1 bg-transparent px-3 text-sm text-ink placeholder:text-inkSoft/80 focus:outline-none"
        />
      </form>

      {projects.length > 0 && <ProjectFilter projects={projects} noneCount={noneCount} value={projectValue} />}

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={`inline-flex h-10 items-center gap-2 rounded-lg border px-3.5 text-sm font-medium transition-colors ${
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
          <div className="absolute right-0 top-full z-30 mt-2 w-[260px] rounded-xl border border-line bg-surface p-3 shadow-lg">
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
    </div>
  );
}
