"use client";

import { useRouter, useSearchParams } from "next/navigation";

type Option = { id: string; name: string };

export default function MarketplaceFilters({
  categories,
  countries,
  languages,
  current,
}: {
  categories: Option[];
  countries: Option[];
  languages: Option[];
  current: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    router.push(`/marketplace?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-3 items-end">
      <div>
        <label className="block text-xs text-inkSoft mb-1">Zoeken op domein</label>
        <input
          type="text"
          placeholder="bv. voorbeeld.nl"
          defaultValue={current.q ?? ""}
          onBlur={(e) => updateParam("q", e.target.value)}
          className="border border-line rounded-md px-3 py-1.5 text-sm w-48"
        />
      </div>
      <Select
        label="Categorie"
        value={current.category ?? ""}
        onChange={(v) => updateParam("category", v)}
        options={categories}
      />
      <Select
        label="Land"
        value={current.country ?? ""}
        onChange={(v) => updateParam("country", v)}
        options={countries}
      />
      <Select
        label="Taal"
        value={current.language ?? ""}
        onChange={(v) => updateParam("language", v)}
        options={languages}
      />
      <div>
        <label className="block text-xs text-inkSoft mb-1">Min. DR</label>
        <input
          type="number"
          min={0}
          defaultValue={current.minDr ?? ""}
          onBlur={(e) => updateParam("minDr", e.target.value)}
          className="border border-line rounded-md px-3 py-1.5 text-sm w-24"
        />
      </div>
      <div>
        <label className="block text-xs text-inkSoft mb-1">Max. prijs (&euro;)</label>
        <input
          type="number"
          min={0}
          defaultValue={current.maxPrice ?? ""}
          onBlur={(e) => updateParam("maxPrice", e.target.value)}
          className="border border-line rounded-md px-3 py-1.5 text-sm w-28"
        />
      </div>
      {(current.q || current.category || current.country || current.language || current.minDr || current.maxPrice) && (
        <button
          onClick={() => router.push("/marketplace")}
          className="text-sm text-inkSoft hover:text-ink underline"
        >
          Filters wissen
        </button>
      )}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Option[];
}) {
  return (
    <div>
      <label className="block text-xs text-inkSoft mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-line rounded-md px-3 py-1.5 text-sm min-w-[140px]"
      >
        <option value="">Alle</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </div>
  );
}
