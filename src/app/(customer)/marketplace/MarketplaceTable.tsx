"use client";

import { Fragment, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, CircleCheck, ExternalLink, Info, Search } from "lucide-react";
import AddToCartButton from "./AddToCartButton";
import CountryFlag from "@/components/CountryFlag";
import { DURATION_YEARS, durationKindLabel, durationLabel } from "@/lib/placementPeriod";
import { FILTER_KEYS, PER_PAGE_OPTIONS, headerSort, pageNumbers, type SortKey } from "@/lib/marketplace";

export type TableRow = {
  websiteProductId: string;
  domain: string;
  niches: string[];
  country: string;
  countryCode: string;
  language: string;
  description: string | null;
  domainRating: number | null;
  domainAuthority: number | null;
  trustFlow: number | null;
  citationFlow: number | null;
  traffic: number | null;
  referringDomains: number | null;
  ipAddress: string | null;
  behindCloudflare: boolean;
  // Whether Google's AI cites the site as a source; null when not known.
  aiCited: boolean | null;
  maxLinks: number | null;
  sponsored: boolean;
  periodic: boolean;
  exampleUrl: string | null;
  // For the chosen topic and number of years; yearly = per year.
  price: number;
  yearly: number;
};

type Option = { id: string; name: string };

const nl = (n: number | null) => (n == null ? "—" : n.toLocaleString("nl-NL"));
// Whole euros as "€129"; a discounted price keeps its cents ("€116,10").
const euro = (n: number) => (Number.isInteger(n) ? `€${n}` : `€${n.toFixed(2).replace(".", ",")}`);

const th = "px-3 py-2.5 text-left text-xs font-semibold text-ink whitespace-nowrap";
const filterCell = "px-1.5 py-2 border-t border-line";
const filterInput =
  "h-8 w-full min-w-0 rounded-md border bg-surface px-2 text-xs text-ink placeholder:text-inkSoft/70 focus:outline-none focus:ring-2 focus:ring-[var(--btn-pay-bg)]";
const on = (active: boolean) => (active ? "border-[var(--btn-pay-bg)]" : "border-line");

export default function MarketplaceTable({
  title,
  type,
  rows,
  pickedId,
  count,
  topic,
  topics,
  years,
  showYears,
  sort,
  page,
  totalPages,
  per,
  niches,
  countries,
  languages,
}: {
  title: string;
  type: "BLOG_POST" | "HOMEPAGE_LINK";
  rows: TableRow[];
  pickedId?: string;
  count: { shown: number; offered: number; accepting: number };
  topic: Option | null;
  topics: Option[];
  years: number;
  showYears: boolean;
  sort: SortKey;
  page: number;
  totalPages: number;
  per: number;
  niches: Option[];
  countries: Option[];
  languages: Option[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const get = (key: string) => searchParams.get(key) ?? "";
  const [open, setOpen] = useState<string | null>(pickedId ?? null);

  function apply(changes: Record<string, string>, keepPage = false) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("type", type);
    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    if (!keepPage) params.delete("page");
    // A site opened from the dashboard (?site=) lets go once you filter.
    if (!("site" in changes)) params.delete("site");
    router.push(`/marketplace?${params.toString()}`, { scroll: keepPage });
  }

  const anyFilter = FILTER_KEYS.some((k) => get(k));
  const clearAll = () => apply(Object.fromEntries(FILTER_KEYS.map((k) => [k, ""])));

  // A typed filter applies on Enter or when you leave the field.
  const typed = (key: string, placeholder: string, align: "left" | "right" = "right") => (
    <input
      key={`${key}-${get(key)}`}
      defaultValue={get(key)}
      placeholder={placeholder}
      aria-label={placeholder}
      inputMode={align === "right" ? "numeric" : "text"}
      onKeyDown={(e) => {
        if (e.key === "Enter") apply({ [key]: e.currentTarget.value.trim() });
      }}
      onBlur={(e) => {
        if (e.currentTarget.value.trim() !== get(key)) apply({ [key]: e.currentTarget.value.trim() });
      }}
      className={`${filterInput} ${on(Boolean(get(key)))} ${align === "right" ? "text-right" : ""}`}
    />
  );
  const picker = (key: string, label: string, options: { value: string; name: string }[]) => (
    <select
      aria-label={label}
      value={get(key)}
      onChange={(e) => apply({ [key]: e.target.value })}
      className={`${filterInput} ${on(Boolean(get(key)))} pr-1 ${get(key) ? "" : "text-inkSoft/80"}`}
    >
      <option value="">Alle</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.name}
        </option>
      ))}
    </select>
  );
  const opts = (list: Option[]) => list.map((o) => ({ value: o.id, name: o.name }));

  // Clicking a header sorts by it (again: the other way round).
  const sortHeader = (label: string, key: SortKey, align = "text-right") => {
    const active = sort.split("-")[0] === key.split("-")[0];
    const Icon = !active ? ArrowUpDown : sort.endsWith("laag") ? ArrowUp : ArrowDown;
    return (
      <th className={`${th} ${align}`}>
        <button
          type="button"
          onClick={() => apply({ sort: key }, false)}
          className={`inline-flex items-center gap-1 hover:text-ink ${active ? "text-ink" : "text-ink/80"}`}
        >
          {label}
          <Icon size={11} className={active ? "" : "text-inkSoft"} />
        </button>
      </th>
    );
  };
  const priceSort: SortKey = sort === "prijs-laag" ? "prijs-hoog" : "prijs-laag";
  const priceHeader = `Prijs${topic ? ` · ${topic.name}` : ""}`;

  const priceNote = (r: TableRow) => (r.periodic ? (years === 1 ? "per jaar" : durationLabel(years)) : null);
  const example = (r: TableRow) =>
    r.exampleUrl ? (
      <a
        href={r.exampleUrl}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="text-[13px] font-medium text-[var(--btn-pay-bg)] underline underline-offset-2"
      >
        Bekijk
      </a>
    ) : (
      <span className="text-xs text-inkSoft">Op aanvraag</span>
    );
  const nicheChips = (r: TableRow) => (
    <span className="inline-flex items-center gap-1 whitespace-nowrap" title={r.niches.join(", ")}>
      <span className="rounded-full bg-[var(--pay-soft)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--btn-pay-bg)]">
        {r.niches[0]}
      </span>
      {r.niches.length > 1 && (
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-inkSoft">+{r.niches.length - 1}</span>
      )}
    </span>
  );
  const addButton = (r: TableRow) => (
    <AddToCartButton websiteProductId={r.websiteProductId} topicId={topic?.id ?? null} durationYears={years} />
  );

  // Everything about a site, opened by clicking its row.
  const details = (r: TableRow) => (
    <div className="grid gap-6 md:grid-cols-2 md:gap-8 text-sm">
      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-inkSoft">Over deze website</div>
        {r.description && <p className="mb-4 text-inkSoft">{r.description}</p>}
        <div className="mb-2 font-semibold text-ink">Niches</div>
        <div className="flex flex-wrap gap-1.5">
          {r.niches.map((n) => (
            <span key={n} className="rounded-full bg-[var(--pay-soft)] px-3 py-1 text-[var(--btn-pay-bg)]">
              {n}
            </span>
          ))}
        </div>
        <div className="mt-4 mb-2 font-semibold text-ink">Taal</div>
        <div className="flex items-center gap-2 text-ink/80">
          <CountryFlag code={r.countryCode} label={r.country} />
          {r.language}
        </div>
      </div>
      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-inkSoft">Cijfers</div>
        {(
          [
            ["Domain Rating (DR)", nl(r.domainRating)],
            ["Domain Authority (DA)", nl(r.domainAuthority)],
            ["Trust Flow (TF)", nl(r.trustFlow)],
            ["Citation Flow (CF)", nl(r.citationFlow)],
            ["Verkeer per maand", nl(r.traffic)],
            ["Verwijzende domeinen", nl(r.referringDomains)],
            ...(r.ipAddress ? [["IP-adres", r.behindCloudflare ? `${r.ipAddress} (Cloudflare)` : r.ipAddress]] : []),
            ...(r.aiCited !== null
              ? [
                  [
                    <span key="ai" className="inline-flex items-center gap-1">
                      AI-Cited
                      <span title="Google AI (AI Overviews of AI Mode) noemt deze website als bron">
                        <Info size={13} className="text-inkSoft/70" />
                      </span>
                    </span>,
                    r.aiCited ? <CircleCheck size={17} className="text-emerald-600" aria-label="Ja" /> : "Nee",
                  ],
                ]
              : []),
          ] as [ReactNode, ReactNode][]
        ).map(([label, value], i) => (
          <div key={i} className="flex items-center justify-between gap-3 border-b border-dashed border-line py-1.5">
            <span className="text-inkSoft">{label}</span>
            <span className="tabular-nums text-ink">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const first = count.shown === 0 ? 0 : (page - 1) * per + 1;
  const last = Math.min(page * per, count.shown);

  return (
    <div className="pb-4">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="font-serif text-2xl text-ink sm:text-3xl">{title}</h1>
        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-inkSoft">
          {topic
            ? `${count.accepting} van ${count.offered} websites accepteren ${topic.name}`
            : `${count.offered} ${count.offered === 1 ? "website" : "websites"}`}
        </span>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2.5">
        <form
          className="flex h-10 w-full max-w-md items-center gap-2 rounded-xl border border-line bg-surface px-3.5 focus-within:ring-2 focus-within:ring-[var(--btn-pay-bg)] md:w-auto md:flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            apply({ q: String(new FormData(e.currentTarget).get("q") ?? "").trim() });
          }}
        >
          <Search size={16} className="shrink-0 text-inkSoft/80" />
          <input
            key={get("q")}
            name="q"
            type="search"
            enterKeyHint="search"
            aria-label="Zoek op domein of niche"
            defaultValue={get("q")}
            placeholder="Zoek op domein of niche"
            className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-inkSoft/80 focus:outline-none"
          />
        </form>
        {anyFilter && (
          <button
            type="button"
            onClick={clearAll}
            className="text-[13px] font-medium text-inkSoft underline underline-offset-2 hover:text-ink"
          >
            Wis filters
          </button>
        )}

        <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-2.5 md:ml-auto md:w-auto">
          {showYears && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-inkSoft">Looptijd</span>
              <div className="flex rounded-xl border border-line bg-surface p-0.5" role="group" aria-label="Looptijd">
                {DURATION_YEARS.map((y) => (
                  <button
                    key={y}
                    type="button"
                    aria-pressed={years === y}
                    onClick={() => apply({ jaar: y === 1 ? "" : String(y) }, true)}
                    className={`rounded-[10px] px-3 py-1.5 text-sm transition ${
                      years === y ? "bg-[var(--btn-pay-bg)] font-semibold text-white" : "text-ink hover:bg-gray-50"
                    }`}
                  >
                    {durationLabel(y)}
                  </button>
                ))}
              </div>
            </div>
          )}
          <label className="flex items-center gap-2">
            <span className="text-sm text-inkSoft">Onderwerp van je link</span>
            <span className="relative">
              <select
                value={topic?.id ?? ""}
                onChange={(e) => apply({ onderwerp: e.target.value })}
                className={`h-10 w-40 appearance-none rounded-xl bg-surface pl-3.5 pr-8 text-sm font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-[var(--btn-pay-bg)] ${
                  topic ? "border-2 border-[var(--btn-pay-bg)]" : "border border-line"
                }`}
              >
                <option value="">Algemeen</option>
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={15}
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-inkSoft"
              />
            </span>
          </label>
        </div>
      </div>

      {/* Desktop: the table, with a filter under every column. */}
      <div className="mt-4 hidden overflow-x-auto rounded-xl border border-line bg-surface md:block">
        <table className="w-full min-w-[1180px] text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className={th}>Domein</th>
              <th className={th}>Niche</th>
              <th className={th}>Land</th>
              <th className={th}>Taal</th>
              {sortHeader("DR", headerSort("dr", sort))}
              {sortHeader("DA", headerSort("da", sort))}
              {sortHeader("Verkeer", headerSort("verkeer", sort))}
              <th className={`${th} text-center`}>Max links</th>
              <th className={th}>Gesponsord</th>
              <th className={th}>Duur</th>
              <th className={th}>Voorbeeld</th>
              {sortHeader(priceHeader, priceSort)}
              <th className={th} />
            </tr>
            <tr className="bg-gray-50/60">
              <td className={`${filterCell} w-[170px]`}>{typed("domain", "Zoeken", "left")}</td>
              <td className={`${filterCell} w-[120px]`}>{picker("niche", "Niche", opts(niches))}</td>
              <td className={`${filterCell} w-[110px]`}>{picker("country", "Land", opts(countries))}</td>
              <td className={`${filterCell} w-[110px]`}>{picker("language", "Taal", opts(languages))}</td>
              <td className={`${filterCell} w-[64px]`}>{typed("minDr", "≥")}</td>
              <td className={`${filterCell} w-[64px]`}>{typed("minDa", "≥")}</td>
              <td className={`${filterCell} w-[84px]`}>{typed("minTraffic", "≥")}</td>
              <td className={`${filterCell} w-[76px]`}>{typed("minLinks", "≥")}</td>
              <td className={`${filterCell} w-[92px]`}>
                {picker("sponsored", "Gesponsord", [
                  { value: "ja", name: "Ja" },
                  { value: "nee", name: "Nee" },
                ])}
              </td>
              <td className={`${filterCell} w-[104px]`}>
                {picker("duur", "Duur", [
                  { value: "permanent", name: "Permanent" },
                  { value: "jaar", name: "Per jaar" },
                ])}
              </td>
              <td className={filterCell} />
              <td className={`${filterCell} w-[104px]`}>{typed("maxPrice", "≤ max")}</td>
              <td className={filterCell} />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isOpen = open === r.websiteProductId;
              return (
                <Fragment key={r.websiteProductId}>
                  <tr
                    onClick={() => setOpen(isOpen ? null : r.websiteProductId)}
                    aria-expanded={isOpen}
                    className={`cursor-pointer border-t border-line/70 ${isOpen ? "bg-brandSoft/20" : "hover:bg-gray-50/60"}`}
                  >
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 font-medium text-ink">
                        {r.domain}
                        <a
                          href={`https://${r.domain}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`${r.domain} bekijken`}
                          className="text-inkSoft hover:text-[var(--btn-pay-bg)]"
                        >
                          <ExternalLink size={12} />
                        </a>
                      </span>
                    </td>
                    <td className="px-3 py-2.5">{nicheChips(r)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-ink/80">{r.country}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-ink/80">{r.language}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink">{nl(r.domainRating)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink/80">{nl(r.domainAuthority)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink/80">{nl(r.traffic)}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-ink/80">{nl(r.maxLinks)}</td>
                    <td className="px-3 py-2.5 text-ink/80">{r.sponsored ? "Ja" : "Nee"}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-ink/80">{durationKindLabel(r.periodic)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{example(r)}</td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      <div className="font-semibold tabular-nums text-ink">{euro(r.price)}</div>
                      {priceNote(r) && <div className="text-[11px] text-inkSoft">{priceNote(r)}</div>}
                    </td>
                    <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                      {addButton(r)}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-brandSoft/20">
                      <td colSpan={13} className="border-t border-line/70 px-5 py-5">
                        {details(r)}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={13} className="border-t border-line px-5 py-10 text-center text-sm text-inkSoft">
                  {topic && count.accepting === 0
                    ? `Nog geen websites die ${topic.name} plaatsen.`
                    : "Geen websites gevonden met deze filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Phone: one card per site; tap to see everything about it. */}
      <div className="mt-4 space-y-2 md:hidden">
        {rows.map((r) => {
          const isOpen = open === r.websiteProductId;
          return (
            <div key={r.websiteProductId} className="rounded-xl border border-line bg-surface">
              <div
                role="button"
                tabIndex={0}
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : r.websiteProductId)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setOpen(isOpen ? null : r.websiteProductId);
                  }
                }}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="truncate font-semibold text-ink">{r.domain}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-inkSoft">
                    {nicheChips(r)}
                    <span className="whitespace-nowrap">
                      DR {nl(r.domainRating)} · {durationKindLabel(r.periodic)}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <span className="rounded-[10px] bg-gray-100 px-2.5 py-2 text-[14.5px] font-bold tabular-nums text-ink">
                    {euro(r.price)}
                  </span>
                  {addButton(r)}
                </div>
              </div>
              {isOpen && (
                <div className="rounded-b-xl border-t border-line bg-brandSoft/20 px-4 py-5">
                  <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink/80">
                    <span>Max links: {nl(r.maxLinks)}</span>
                    <span>Gesponsord: {r.sponsored ? "Ja" : "Nee"}</span>
                    <span>Voorbeeld: {example(r)}</span>
                  </div>
                  {details(r)}
                </div>
              )}
            </div>
          );
        })}
        {rows.length === 0 && (
          <div className="rounded-xl border border-line bg-surface px-5 py-10 text-center text-sm text-inkSoft">
            Geen websites gevonden met deze filters.
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-col items-center gap-3 text-sm text-inkSoft sm:flex-row sm:justify-between">
        <span>
          {first}–{last} van {count.shown} · prijzen excl. btw
        </span>
        {totalPages > 1 && (
          <span className="flex items-center gap-1.5">
            {page > 1 && (
              <button
                type="button"
                onClick={() => apply({ page: String(page - 1) }, true)}
                aria-label="Vorige pagina"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-ink"
              >
                ←
              </button>
            )}
            {pageNumbers(page, totalPages).map((p, i) =>
              p === 0 ? (
                <span key={`gap-${i}`} className="px-1">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  aria-current={p === page ? "page" : undefined}
                  onClick={() => apply({ page: String(p) }, true)}
                  className={`flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 ${
                    p === page
                      ? "border-[var(--btn-pay-bg)] bg-[var(--btn-pay-bg)] font-semibold text-white"
                      : "border-line bg-surface text-ink"
                  }`}
                >
                  {p}
                </button>
              )
            )}
            {page < totalPages && (
              <button
                type="button"
                onClick={() => apply({ page: String(page + 1) }, true)}
                aria-label="Volgende pagina"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-ink"
              >
                →
              </button>
            )}
          </span>
        )}
        <label className="flex items-center gap-1.5">
          Toon
          <select
            value={per}
            onChange={(e) => apply({ per: e.target.value === "50" ? "" : e.target.value })}
            className="h-8 rounded-lg border border-line bg-surface px-2 text-sm text-ink"
          >
            {PER_PAGE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          per pagina
        </label>
      </div>
    </div>
  );
}
