"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Search } from "lucide-react";
import { ORDER_SORTS } from "@/lib/customerOrders";

const selectClass =
  "h-10 appearance-none rounded-lg border border-line bg-surface pl-3 pr-8 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand";

function useApply() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const get = (key: string) => searchParams.get(key) ?? "";

  function apply(changes: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    // Another search, kind or order starts on the first page again.
    params.delete("pagina");
    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const query = params.toString();
    router.push(query ? `/dashboard/orders?${query}` : "/dashboard/orders");
  }
  return { get, apply };
}

const KINDS = [
  { value: "", label: "Soort: alles" },
  { value: "blog", label: "Blogartikelen" },
  { value: "homepage", label: "Homepage links" },
];

// On a phone: kind and order as two chips at the end of the status row (a
// hidden select on top of each does the choosing).
export function OrderSortChips() {
  const { get, apply } = useApply();
  const chip =
    "relative inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-ink/80";
  const sort = get("sort") || "nieuw";
  return (
    <>
      <label className={chip}>
        {KINDS.find((k) => k.value === get("soort"))?.label ?? "Soort: alles"}
        <ChevronDown size={14} className="text-inkSoft" />
        <select
          aria-label="Soort"
          value={get("soort")}
          onChange={(e) => apply({ soort: e.target.value })}
          className="absolute inset-0 opacity-0"
        >
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </label>
      <label className={chip}>
        {ORDER_SORTS.find((o) => o.value === sort)?.label}
        <ChevronDown size={14} className="text-inkSoft" />
        <select
          aria-label="Sorteren"
          value={sort}
          onChange={(e) =>
            apply({ sort: e.target.value === "nieuw" ? "" : e.target.value })
          }
          className="absolute inset-0 opacity-0"
        >
          {ORDER_SORTS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

// Search on website or order number, the kind of link, and the order — kept in
// the URL next to the status tab, like the marketplace filters.
export default function OrdersToolbar() {
  const { get, apply } = useApply();
  const search = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    apply({ q: String(new FormData(e.currentTarget).get("q") ?? "").trim() });
  };

  return (
    <>
      {/* Phone: just the search bar; kind and order sit in the status row. */}
      <form
        className="mt-4 flex h-[46px] items-center gap-2 rounded-xl border border-line bg-surface px-3.5 focus-within:ring-2 focus-within:ring-[var(--btn-pay-bg)] md:hidden"
        onSubmit={search}
      >
        <Search size={17} className="shrink-0 text-inkSoft/80" />
        <input
          key={get("q")}
          name="q"
          type="search"
          enterKeyHint="search"
          aria-label="Zoek op website of ordernummer"
          defaultValue={get("q")}
          placeholder="Zoek op website of ordernummer"
          className="min-w-0 flex-1 bg-transparent text-[15px] text-ink placeholder:text-inkSoft/80 focus:outline-none"
        />
      </form>
      <div className="mt-5 hidden flex-wrap items-center gap-2.5 rounded-xl border border-line bg-surface p-3 md:flex">
        <form
          className="flex h-10 min-w-[240px] flex-1 overflow-hidden rounded-lg border border-line bg-surface focus-within:ring-2 focus-within:ring-brand"
          onSubmit={search}
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
          <select
            value={get("soort")}
            onChange={(e) => apply({ soort: e.target.value })}
            className={selectClass}
          >
            <option value="">Soort: alles</option>
            <option value="blog">Blogartikelen</option>
            <option value="homepage">Homepage links</option>
          </select>
          <ChevronDown
            size={15}
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-inkSoft"
          />
        </label>

        <label className="relative">
          <span className="sr-only">Sorteren</span>
          <select
            value={get("sort") || "nieuw"}
            onChange={(e) =>
              apply({ sort: e.target.value === "nieuw" ? "" : e.target.value })
            }
            className={selectClass}
          >
            {ORDER_SORTS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={15}
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-inkSoft"
          />
        </label>
      </div>
    </>
  );
}
