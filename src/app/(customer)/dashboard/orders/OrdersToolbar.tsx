"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Search } from "lucide-react";
import { ORDER_SORTS } from "@/lib/customerOrders";

const selectClass =
  "h-10 appearance-none rounded-lg border border-line bg-surface pl-3 pr-8 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand";

// Search on website or order number, the kind of link, and the order — kept in
// the URL next to the status tab, like the marketplace filters.
export default function OrdersToolbar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const get = (key: string) => searchParams.get(key) ?? "";

  function apply(changes: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const query = params.toString();
    router.push(query ? `/dashboard/orders?${query}` : "/dashboard/orders");
  }

  return (
    <div className="mt-5 flex flex-wrap items-center gap-2.5 rounded-xl border border-line bg-surface p-3">
      <form
        className="flex h-10 min-w-[240px] flex-1 overflow-hidden rounded-lg border border-line bg-surface focus-within:ring-2 focus-within:ring-brand"
        onSubmit={(e) => {
          e.preventDefault();
          apply({ q: String(new FormData(e.currentTarget).get("q") ?? "").trim() });
        }}
      >
        <input
          key={get("q")}
          name="q"
          type="search"
          aria-label="Zoek op website of ordernummer"
          defaultValue={get("q")}
          placeholder="Zoek op website of ordernummer"
          className="min-w-0 flex-1 px-3.5 text-sm text-ink placeholder:text-inkSoft/80 focus:outline-none"
        />
        <button
          type="submit"
          className="flex items-center gap-2 border-l border-line bg-gray-100 px-4 text-sm font-medium text-ink transition-colors hover:bg-gray-200"
        >
          <Search size={15} />
          Zoeken
        </button>
      </form>

      <label className="relative">
        <span className="sr-only">Soort</span>
        <select value={get("soort")} onChange={(e) => apply({ soort: e.target.value })} className={selectClass}>
          <option value="">Soort: alles</option>
          <option value="blog">Blogartikelen</option>
          <option value="homepage">Homepage links</option>
        </select>
        <ChevronDown size={15} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-inkSoft" />
      </label>

      <label className="relative">
        <span className="sr-only">Sorteren</span>
        <select value={get("sort") || "nieuw"} onChange={(e) => apply({ sort: e.target.value === "nieuw" ? "" : e.target.value })} className={selectClass}>
          {ORDER_SORTS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown size={15} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-inkSoft" />
      </label>
    </div>
  );
}
