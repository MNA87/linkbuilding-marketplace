"use client";

import { useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Plus, X } from "lucide-react";
import { adminAddNicheAction } from "./actions";
import { addWorldItemAction } from "@/app/admin/settings/actions";
import { WORLD_COUNTRIES, WORLD_LANGUAGES, worldSuggestions } from "@/lib/worldLists";
import { PRODUCT_NAMES, type ProductTypeKey } from "@/lib/websiteProducts";

// The parts of a website's form shared by its tabs (Gegevens, Prijzen) and
// by "Nieuwe website": the same fields, in the same place, both times.

export type Option = { id: string; name: string };

export type DetailsState = {
  domain: string;
  description: string;
  countryId: string;
  languageId: string;
  nicheIds: string[];
  maxLinks: string;
  sponsored: boolean;
  exampleUrl: string;
};

export type PriceColumnState = {
  type: ProductTypeKey;
  enabled: boolean;
  periodic: boolean;
  // "" = Algemeen; otherwise a topic id. Empty = not placed.
  prices: Record<string, string>;
};

export const card = "rounded-xl border border-line bg-surface";
const label = "mb-1 block text-xs font-medium text-inkSoft";
const input =
  "h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-inkSoft/60 focus:outline-none focus:ring-2 focus:ring-[var(--btn-pay-bg)]";
const SAGE = "bg-[#eff3f0] text-[#5b7266]";

function Select({
  value,
  onChange,
  options,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder: string;
  ariaLabel: string;
}) {
  return (
    <span className="relative block">
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${input} appearance-none pr-8 ${value ? "" : "text-inkSoft/70"}`}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-inkSoft" />
    </span>
  );
}

// Land or Taal: pick one from the list, or type to find any country or
// language in the world; a new one is added to the list (Instellingen →
// Lijsten) on the spot, its code filled in.
function WorldPicker({
  kind,
  options,
  value,
  onChange,
  ariaLabel,
}: {
  kind: "country" | "language";
  options: Option[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel: string;
}) {
  const [added, setAdded] = useState<Option[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const all = [...options, ...added.filter((a) => !options.some((o) => o.id === a.id))];
  const current = all.find((o) => o.id === value);
  const q = query.trim().toLowerCase();
  const matches = all.filter((o) => !q || o.name.toLowerCase().includes(q));
  const fresh = worldSuggestions(kind === "country" ? WORLD_COUNTRIES : WORLD_LANGUAGES, query, [], 8)
    .filter((w) => !all.some((o) => o.name.toLowerCase() === w.name.toLowerCase()))
    .slice(0, 5);

  const pick = (id: string) => {
    onChange(id);
    setQuery("");
    setOpen(false);
    setError(null);
  };
  const add = async (code: string) => {
    setBusy(true);
    setError(null);
    const r = await addWorldItemAction(kind, code);
    setBusy(false);
    if (r.error || !r.item) return setError(r.error ?? "Toevoegen mislukt.");
    const item = r.item;
    setAdded((list) => (list.some((x) => x.id === item.id) ? list : [...list, item]));
    pick(item.id);
  };

  return (
    <span className="relative block">
      <input
        value={open ? query : (current?.name ?? "")}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          if (matches[0] && q) pick(matches[0].id);
          else if (fresh[0]) void add(fresh[0].code);
        }}
        placeholder={open ? "Typ om te zoeken…" : "Kies…"}
        aria-label={ariaLabel}
        className={`${input} pr-8`}
      />
      <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-inkSoft" />
      {open && (matches.length > 0 || fresh.length > 0) && (
        <div className="absolute left-0 right-0 top-11 z-30 max-h-64 overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-lg">
          {matches.map((o) => (
            <button
              key={o.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(o.id)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-sm text-ink hover:bg-gray-50 ${
                o.id === value ? "font-semibold" : ""
              }`}
            >
              {o.name}
              {o.id === value && <Check size={14} className="text-[var(--btn-pay-bg)]" />}
            </button>
          ))}
          {fresh.length > 0 && (
            <>
              <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-inkSoft">
                Nieuw toevoegen
              </div>
              {fresh.map((w) => (
                <button
                  key={w.code}
                  type="button"
                  disabled={busy}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => void add(w.code)}
                  className="flex w-full items-center gap-1.5 rounded-lg px-3 py-1.5 text-left text-sm font-medium text-[var(--btn-pay-bg)] hover:bg-gray-50 disabled:opacity-60"
                >
                  <Plus size={14} /> {w.name}
                </button>
              ))}
            </>
          )}
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </span>
  );
}

// The site's niches: the first is the main one. Type to pick an existing
// niche, or add a new one on the spot.
export function NichePicker({
  options,
  value,
  onChange,
  onCreated,
}: {
  options: Option[];
  value: string[];
  onChange: (ids: string[]) => void;
  onCreated: (niche: Option) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);
  const q = query.trim().toLowerCase();
  const suggestions = options.filter((o) => !value.includes(o.id) && (!q || o.name.toLowerCase().includes(q)));
  const exact = options.some((o) => o.name.toLowerCase() === q);

  const pick = (id: string) => {
    onChange([...value, id]);
    setQuery("");
    setError(null);
    inputRef.current?.focus();
  };
  const create = async () => {
    if (!q || busy) return;
    setBusy(true);
    setError(null);
    const r = await adminAddNicheAction(query);
    setBusy(false);
    if (r.error || !r.niche) return setError(r.error ?? "Toevoegen mislukt.");
    onCreated(r.niche);
    if (!value.includes(r.niche.id)) onChange([...value, r.niche.id]);
    setQuery("");
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        {value.map((id, i) => (
          <span
            key={id}
            className={`inline-flex items-center gap-1 rounded-full py-1 pl-3 pr-1.5 text-xs font-medium ${SAGE}`}
          >
            {i === 0 ? (
              <span>
                {byId.get(id)?.name ?? "…"} <span className="opacity-70">· hoofd</span>
              </span>
            ) : (
              <button
                type="button"
                title="Maak dit de hoofdniche"
                onClick={() => onChange([id, ...value.filter((v) => v !== id)])}
                className="hover:underline"
              >
                {byId.get(id)?.name ?? "…"}
              </button>
            )}
            <button
              type="button"
              aria-label={`${byId.get(id)?.name ?? "Niche"} weghalen`}
              onClick={() => onChange(value.filter((v) => v !== id))}
              className="rounded-full p-0.5 hover:bg-black/5"
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <span className="relative">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              if (suggestions[0] && (exact || !q || suggestions.length === 1)) pick(suggestions[0].id);
              else if (q && !exact) void create();
            }}
            placeholder="+ niche"
            aria-label="Niche toevoegen"
            className="h-7 w-32 rounded-full border border-dashed border-line bg-surface px-3 text-xs text-ink placeholder:text-inkSoft focus:w-44 focus:outline-none focus:ring-2 focus:ring-[var(--btn-pay-bg)]"
          />
          {open && (suggestions.length > 0 || (q && !exact)) && (
            <div className="absolute left-0 top-9 z-30 max-h-60 w-56 overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-lg">
              {suggestions.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(o.id)}
                  className="block w-full rounded-lg px-3 py-1.5 text-left text-sm text-ink hover:bg-gray-50"
                >
                  {o.name}
                </button>
              ))}
              {q && !exact && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => void create()}
                  className="flex w-full items-center gap-1.5 rounded-lg px-3 py-1.5 text-left text-sm font-medium text-[var(--btn-pay-bg)] hover:bg-gray-50"
                >
                  <Plus size={14} /> &lsquo;{query.trim()}&rsquo; toevoegen
                </button>
              )}
            </div>
          )}
        </span>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

// "Over de website" and "Plaatsing", side by side.
export function DetailsFields({
  value,
  onChange,
  countries,
  languages,
  niches,
  onNicheCreated,
}: {
  value: DetailsState;
  onChange: (next: DetailsState) => void;
  countries: Option[];
  languages: Option[];
  niches: Option[];
  onNicheCreated: (niche: Option) => void;
}) {
  const set = <K extends keyof DetailsState>(key: K, v: DetailsState[K]) => onChange({ ...value, [key]: v });
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <section className={`${card} p-5`}>
        <h2 className="font-semibold text-ink">Over de website</h2>
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className={label}>Domein</span>
            <input
              value={value.domain}
              onChange={(e) => set("domain", e.target.value)}
              placeholder="voorbeeld.nl"
              className={input}
            />
          </label>
          <label className="block">
            <span className={label}>Omschrijving (zien klanten bij de details)</span>
            <textarea
              value={value.description}
              onChange={(e) => set("description", e.target.value)}
              rows={3}
              placeholder="Waar gaat de website over, voor wie?"
              className={`${input} h-auto py-2`}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className={label}>Land</span>
              <WorldPicker
                kind="country"
                ariaLabel="Land"
                value={value.countryId}
                onChange={(v) => set("countryId", v)}
                options={countries}
              />
            </div>
            <div>
              <span className={label}>Taal</span>
              <WorldPicker
                kind="language"
                ariaLabel="Taal"
                value={value.languageId}
                onChange={(v) => set("languageId", v)}
                options={languages}
              />
            </div>
          </div>
          <div>
            <span className={label}>Niches (de eerste is de hoofdniche)</span>
            <NichePicker
              options={niches}
              value={value.nicheIds}
              onChange={(ids) => set("nicheIds", ids)}
              onCreated={onNicheCreated}
            />
          </div>
        </div>
      </section>

      <section className={`${card} p-5`}>
        <h2 className="font-semibold text-ink">Plaatsing</h2>
        <p className="text-xs text-inkSoft">Wat klanten in het overzicht zien.</p>
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={label}>Max links per artikel</span>
              <input
                value={value.maxLinks}
                onChange={(e) => set("maxLinks", e.target.value)}
                inputMode="numeric"
                placeholder="bv. 2"
                className={input}
              />
            </label>
            <div>
              <span className={label}>Gesponsord-label</span>
              <Select
                ariaLabel="Gesponsord-label"
                value={value.sponsored ? "ja" : "nee"}
                onChange={(v) => set("sponsored", v === "ja")}
                options={[
                  { id: "nee", name: "Nee" },
                  { id: "ja", name: "Ja" },
                ]}
                placeholder="Kies…"
              />
            </div>
          </div>
          <label className="block">
            <span className={label}>Voorbeeldartikel</span>
            <input
              value={value.exampleUrl}
              onChange={(e) => set("exampleUrl", e.target.value)}
              placeholder="Leeg = &ldquo;Op aanvraag&rdquo;"
              className={input}
            />
          </label>
        </div>
      </section>
    </div>
  );
}

// "Prijzen": topics down, products across; per product whether it's offered
// and its "Duur".
export function PricesTable({
  value,
  onChange,
  topics,
}: {
  value: PriceColumnState[];
  onChange: (next: PriceColumnState[]) => void;
  topics: Option[];
}) {
  const rows: Option[] = [{ id: "", name: "Algemeen" }, ...topics];
  const update = (i: number, change: Partial<PriceColumnState>) =>
    onChange(value.map((c, j) => (j === i ? { ...c, ...change } : c)));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-y border-line bg-gray-50 text-left align-top">
            <th className="px-5 py-3 text-xs font-semibold text-ink">Onderwerp</th>
            {value.map((c, i) => (
              <th key={c.type} className="px-5 py-3">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={c.enabled}
                  onClick={() => update(i, { enabled: !c.enabled })}
                  className="flex items-center gap-2 text-xs font-semibold text-ink"
                >
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded border ${
                      c.enabled ? "border-[var(--btn-pay-bg)] bg-[var(--btn-pay-bg)]" : "border-line bg-surface"
                    }`}
                  >
                    {c.enabled && <Check size={11} strokeWidth={3} className="text-white" />}
                  </span>
                  {PRODUCT_NAMES[c.type]}
                  {!c.enabled && <span className="font-normal text-inkSoft">· niet aangeboden</span>}
                </button>
                {c.enabled && (
                  <div
                    className="mt-1.5 inline-flex rounded-lg border border-line bg-surface p-0.5 text-[11px]"
                    role="group"
                  >
                    {[
                      [false, "Permanent"],
                      [true, "Per jaar"],
                    ].map(([periodic, name]) => (
                      <button
                        key={String(periodic)}
                        type="button"
                        aria-pressed={c.periodic === periodic}
                        onClick={() => update(i, { periodic: periodic as boolean })}
                        className={`rounded-md px-2 py-0.5 ${
                          c.periodic === periodic ? "bg-[var(--btn-pay-bg)] font-semibold text-white" : "text-inkSoft"
                        }`}
                      >
                        {name as string}
                      </button>
                    ))}
                  </div>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id || "algemeen"} className="border-b border-line/70">
              <td className="px-5 py-2.5 font-medium text-ink">{t.name}</td>
              {value.map((c, i) => {
                const v = c.prices[t.id] ?? "";
                return (
                  <td key={c.type} className={`px-5 py-2.5 ${c.enabled ? "" : "opacity-40"}`}>
                    <span className="flex items-center gap-1.5 text-inkSoft">
                      €
                      <input
                        value={v}
                        disabled={!c.enabled}
                        onChange={(e) => update(i, { prices: { ...c.prices, [t.id]: e.target.value } })}
                        inputMode="decimal"
                        placeholder={t.id ? "niet" : "verplicht"}
                        aria-label={`Prijs ${t.name} ${PRODUCT_NAMES[c.type]}`}
                        className={`h-9 w-28 rounded-lg border bg-surface px-3 text-right text-sm text-ink placeholder:text-inkSoft/50 focus:outline-none focus:ring-2 focus:ring-[var(--btn-pay-bg)] ${
                          v ? "border-line" : "border-dashed border-line"
                        }`}
                      />
                      {c.periodic && v && <span className="text-xs">/jaar</span>}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// The fixed bar with the one Opslaan button.
export function SaveBar({
  dirty,
  pending,
  message,
  label = "Opslaan",
  onSave,
}: {
  dirty: boolean;
  pending: boolean;
  message: { ok: boolean; text: string } | null;
  label?: string;
  onSave: () => void;
}) {
  return (
    <div className="sticky bottom-0 z-10 mt-5 flex flex-wrap items-center justify-end gap-3 rounded-xl border border-line bg-surface px-5 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
      <span className={`text-sm ${message ? (message.ok ? "text-emerald-700" : "text-red-600") : "text-inkSoft"}`}>
        {message ? message.text : dirty ? "Wijzigingen nog niet opgeslagen" : "Alles is opgeslagen"}
      </span>
      <button
        type="button"
        onClick={onSave}
        disabled={pending || !dirty}
        className="btn-pay rounded-lg px-5 py-2 text-sm font-semibold disabled:opacity-50"
      >
        {pending ? "Bezig..." : label}
      </button>
    </div>
  );
}
