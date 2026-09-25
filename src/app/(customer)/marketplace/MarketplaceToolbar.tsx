"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Filter, Search, X } from "lucide-react";
import { SORTS, DEFAULT_SORT } from "@/lib/marketplace";

type Option = { id: string; name: string };

const selectClass =
  "h-10 appearance-none rounded-lg border border-line bg-surface pl-3 pr-8 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand";

// Search with its own button, category and sort always in view; the rarer
// filters (DR, price, country, language) behind the filter button.
export default function MarketplaceToolbar({
  categories,
  countries,
  languages,
}: {
  categories: Option[];
  countries: Option[];
  languages: Option[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const get = (key: string) => searchParams.get(key) ?? "";
  const [filtersOpen, setFiltersOpen] = useState(false);

  function apply(changes: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page");
    router.push(`/marketplace?${params.toString()}`);
  }

  const nameOf = (options: Option[], id: string) => options.find((o) => o.id === id)?.name ?? "";
  const active = [
    get("q") && { key: "q", label: `“${get("q")}”` },
    get("minDr") && { key: "minDr", label: `DR vanaf ${get("minDr")}` },
    get("maxPrice") && { key: "maxPrice", label: `Tot €${get("maxPrice")}` },
    get("country") && { key: "country", label: nameOf(countries, get("country")) },
    get("language") && { key: "language", label: nameOf(languages, get("language")) },
  ].filter(Boolean) as { key: string; label: string }[];
  const extraFilterCount = active.filter((a) => a.key !== "q").length;

  return (
    <div className="mt-5">
      <div className="bg-surface border border-line rounded-xl p-3 flex flex-wrap gap-2.5 items-center">
        <form
          className="flex h-10 flex-1 min-w-[240px] overflow-hidden rounded-lg border border-line bg-surface focus-within:ring-2 focus-within:ring-brand"
          onSubmit={(e) => {
            e.preventDefault();
            apply({ q: String(new FormData(e.currentTarget).get("q") ?? "").trim() });
          }}
        >
          <input
            key={get("q")}
            name="q"
            type="search"
            aria-label="Zoek op domein"
            defaultValue={get("q")}
            placeholder="Zoek op domein"
            className="flex-1 min-w-0 px-3.5 text-sm text-ink placeholder:text-inkSoft/80 focus:outline-none"
          />
          <button
            type="submit"
            className="flex items-center gap-2 border-l border-line bg-gray-100 px-4 text-sm font-medium text-ink hover:bg-gray-200 transition-colors"
          >
            <Search size={15} />
            Zoeken
          </button>
        </form>

        <label className="relative">
          <span className="sr-only">Categorie</span>
          <select value={get("category")} onChange={(e) => apply({ category: e.target.value })} className={selectClass}>
            <option value="">Categorie: alle</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <ChevronDown size={15} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-inkSoft" />
        </label>

        <label className="relative">
          <span className="sr-only">Sorteren</span>
          <select
            value={get("sort") || DEFAULT_SORT}
            onChange={(e) => apply({ sort: e.target.value === DEFAULT_SORT ? "" : e.target.value })}
            className={selectClass}
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                Sorteer: {s.label}
              </option>
            ))}
          </select>
          <ChevronDown size={15} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-inkSoft" />
        </label>

        <button
          type="button"
          onClick={() => setFiltersOpen((o) => !o)}
          aria-expanded={filtersOpen}
          aria-label="Meer filters"
          title="Meer filters"
          className={`relative flex h-10 w-10 items-center justify-center rounded-lg border transition-colors ${
            filtersOpen ? "border-brand bg-brandSoft text-brand" : "border-line bg-surface text-inkSoft hover:text-ink"
          }`}
        >
          <Filter size={16} />
          {extraFilterCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 rounded-full bg-brand px-1 text-[10px] font-medium leading-4 text-white">
              {extraFilterCount}
            </span>
          )}
        </button>
      </div>

      {filtersOpen && (
        <form
          className="mt-2 bg-surface border border-line rounded-xl p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5 items-end"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            apply({
              minDr: String(data.get("minDr") ?? ""),
              maxPrice: String(data.get("maxPrice") ?? ""),
              country: String(data.get("country") ?? ""),
              language: String(data.get("language") ?? ""),
            });
            setFiltersOpen(false);
          }}
        >
          <label className="text-xs text-inkSoft">
            DR vanaf
            <input name="minDr" type="number" min={0} max={100} defaultValue={get("minDr")} className="mt-1 h-10 w-full rounded-lg border border-line px-3 text-sm text-ink" />
          </label>
          <label className="text-xs text-inkSoft">
            Prijs tot (€ per jaar)
            <input name="maxPrice" type="number" min={0} defaultValue={get("maxPrice")} className="mt-1 h-10 w-full rounded-lg border border-line px-3 text-sm text-ink" />
          </label>
          <label className="text-xs text-inkSoft">
            Land
            <select name="country" defaultValue={get("country")} className="mt-1 h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink">
              <option value="">Alle</option>
              {countries.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-inkSoft">
            Taal
            <select name="language" defaultValue={get("language")} className="mt-1 h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink">
              <option value="">Alle</option>
              {languages.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn-primary h-10 rounded-lg px-4 text-sm font-medium">
            Toepassen
          </button>
        </form>
      )}

      {active.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {active.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => apply({ [a.key]: "" })}
              className="inline-flex items-center gap-1.5 rounded-full bg-brandSoft px-3 py-1 text-xs font-medium text-brand hover:bg-brandSoft/70"
            >
              {a.label}
              <X size={12} />
            </button>
          ))}
          <button
            type="button"
            onClick={() => apply({ q: "", minDr: "", maxPrice: "", country: "", language: "", category: "" })}
            className="text-xs text-inkSoft hover:text-ink"
          >
            Wis filters
          </button>
        </div>
      )}
    </div>
  );
}
