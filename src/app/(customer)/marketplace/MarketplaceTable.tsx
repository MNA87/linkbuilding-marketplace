"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronDown,
  CircleCheck,
  Columns3,
  ExternalLink,
  Info,
  Lock,
  GripVertical,
  Search,
  SlidersHorizontal,
  Tag,
  X,
} from "lucide-react";
import AddToCartButton from "./AddToCartButton";
import CountryFlag from "@/components/CountryFlag";
import { durationKindLabel } from "@/lib/placementPeriod";
import {
  COLUMNS_COOKIE,
  COLUMN_FILTERS,
  DEFAULT_COLUMNS,
  DEFAULT_SORT,
  FILTER_KEYS,
  OPTIONAL_COLUMNS,
  PER_PAGE_OPTIONS,
  headerSort,
  moveColumn,
  pageNumbers,
  serializeColumns,
  type ColumnKey,
  type ColumnPrefs,
  type SortKey,
} from "@/lib/marketplace";

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
  // For the chosen topic; per year for a site sold per year.
  price: number;
  yearly: number;
};

type Option = { id: string; name: string };

const nl = (n: number | null) => (n == null ? "—" : n.toLocaleString("nl-NL"));
// Whole euros as "€129"; a discounted price keeps its cents ("€116,10").
const euro = (n: number) => (Number.isInteger(n) ? `€${n}` : `€${n.toFixed(2).replace(".", ",")}`);

const th = "px-3 py-2.5 text-left text-xs font-semibold text-ink whitespace-nowrap";
const filterCell = "px-1.5 py-2 border-t border-line";
// With many columns the table scrolls sideways; Domein stays on the left and
// Prijs + "Voeg toe" on the right, so the button never scrolls out of view.
const ADD_WIDTH = "w-[120px] min-w-[120px]";
const STICKY = {
  left: "sticky left-0 z-10 shadow-[6px_0_6px_-6px_rgba(0,0,0,0.12)]",
  price: "sticky right-[120px] z-10 shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.12)]",
  add: `sticky right-0 z-10 ${ADD_WIDTH}`,
};
// Sticky cells need a solid background (the rows' tints are see-through).
const HEAD_BG = "bg-gray-50";
const FILTER_BG = "bg-[#fbfcfd]";
const filterInput =
  "h-8 w-full min-w-0 rounded-md border bg-surface px-2 text-xs text-ink placeholder:text-inkSoft/70 focus:outline-none focus:ring-2 focus:ring-[var(--btn-pay-bg)]";
// Sorting on a phone, where there are no column headers to click.
const MOBILE_SORTS: [SortKey, string][] = [
  ["dr", "DR hoog–laag"],
  ["da", "DA hoog–laag"],
  ["verkeer", "Verkeer hoog–laag"],
  ["prijs-laag", "Prijs laag–hoog"],
  ["prijs-hoog", "Prijs hoog–laag"],
  ["nieuw", "Nieuwste"],
];
const mobileChip = (active: boolean) =>
  `flex h-10 items-center gap-2 rounded-xl border bg-surface px-3 text-sm ${
    active ? "border-[var(--btn-pay-bg)] font-semibold text-ink" : "border-line text-ink"
  }`;

// Niche labels: a quiet sage, so the green of "Voeg toe" is the only thing
// that stands out in a row.
const NICHE_LABEL = "bg-[#eff3f0] text-[#5b7266]";
const on = (active: boolean) => (active ? "border-[var(--btn-pay-bg)]" : "border-line");

// What each column means, shown when you point at (or tab to) its name.
const COLUMN_TIPS: Record<string, string> = {
  Domein: "De website waarop je link komt. Klik op het pijltje om de site te bekijken.",
  Niche: "Over welke onderwerpen de website schrijft.",
  Land: "Het land waar de website zich op richt.",
  Taal: "De taal waarin de website schrijft.",
  DR: "Domain Rating van Ahrefs (0–100): hoe sterk de links naar deze website zijn.",
  DA: "Domain Authority van Moz (0–100): hoe goed de website naar verwachting scoort in Google.",
  Verkeer: "Het geschatte aantal bezoekers per maand via Google, volgens Ahrefs.",
  TF: "Trust Flow van Majestic (0–100): hoe betrouwbaar de websites zijn die naar deze site linken.",
  CF: "Citation Flow van Majestic (0–100): hoeveel linkkracht er naar deze website gaat.",
  "Verw. domeinen": "Het aantal verschillende websites dat naar deze website linkt, volgens Ahrefs.",
  "Max links": "Hoeveel links er maximaal in het artikel mogen staan.",
  Gesponsord: "Of de website bij het artikel vermeldt dat het een gesponsord bericht is.",
  Duur: "Permanent: blijft online, je betaalt één keer. Per jaar: de prijs is per jaar; het aantal jaar kies je bij het bestellen.",
  Voorbeeld: "Een artikel dat al eerder op deze website is geplaatst. Op aanvraag: vraag ons gerust om een voorbeeld.",
  Prijs: "Wat je betaalt, excl. btw.",
};

// A column name with a dotted line; its explanation pops up below it. Fixed
// on the screen, so the table's scrolling can't cut it off.
function HeaderTip({ label, tip }: { label: string; tip: string }) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const show = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setPos({ left: Math.max(8, Math.min(r.left - 8, window.innerWidth - 230)), top: r.bottom + 6 });
  };
  return (
    <span
      tabIndex={0}
      onMouseEnter={(e) => show(e.currentTarget)}
      onMouseLeave={() => setPos(null)}
      onFocus={(e) => show(e.currentTarget)}
      onBlur={() => setPos(null)}
      className="cursor-help border-b border-dashed border-ink/50 pb-px focus:outline-none"
    >
      {label}
      {pos && (
        <span
          role="tooltip"
          style={{ left: pos.left, top: pos.top }}
          className="pointer-events-none fixed z-50 w-max max-w-[220px] whitespace-normal rounded-lg border border-line bg-surface px-2.5 py-1.5 text-left text-xs font-normal leading-snug text-ink shadow-md"
        >
          {tip}
        </span>
      )}
    </span>
  );
}

// The main niche, "+2" for the others; pointing at it lists them all.
// With fit (the cards on a phone) only the main niche, cut short when it's
// long, so the row never needs a second line; the details list them all.
function NicheChips({ niches, fit = false }: { niches: string[]; fit?: boolean }) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const more = !fit && niches.length > 1;
  const show = (el: HTMLElement) => {
    if (!more) return;
    const r = el.getBoundingClientRect();
    setPos({ left: Math.max(8, Math.min(r.left, window.innerWidth - 200)), top: r.bottom + 6 });
  };
  return (
    <span
      tabIndex={more ? 0 : undefined}
      onMouseEnter={(e) => show(e.currentTarget)}
      onMouseLeave={() => setPos(null)}
      onFocus={(e) => show(e.currentTarget)}
      onBlur={() => setPos(null)}
      className={`inline-flex items-center gap-1 whitespace-nowrap focus:outline-none ${fit ? "min-w-0" : ""} ${more ? "cursor-help" : ""}`}
    >
      <span
        className={`rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${NICHE_LABEL} ${fit ? "min-w-0 truncate" : ""}`}
      >
        {niches[0]}
      </span>
      {more && (
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-inkSoft">+{niches.length - 1}</span>
      )}
      {pos && (
        <span
          role="tooltip"
          style={{ left: pos.left, top: pos.top }}
          className="pointer-events-none fixed z-50 w-max max-w-[190px] whitespace-normal rounded-lg border border-line bg-surface px-3 py-2 text-left text-xs font-normal text-ink shadow-md"
        >
          <span className="mb-1 flex items-center gap-1.5 font-semibold">
            <Tag size={12} className="text-inkSoft" />
            Niches
          </span>
          {niches.map((n) => (
            <span key={n} className="block leading-5 text-ink/80">
              • {n}
            </span>
          ))}
        </span>
      )}
    </span>
  );
}

const headerLabel = (label: string, tipKey = label) => <HeaderTip label={label} tip={COLUMN_TIPS[tipKey]} />;

// The "Kolommen" menu: Domein (first) and Prijs (last) always; the rest by
// tick box, and dragged by the grip into the order you like (or moved with
// the arrow keys on the grip).
const COLUMN_NAMES: Record<ColumnKey, string> = {
  niche: "Niche",
  land: "Land",
  taal: "Taal",
  dr: "DR",
  da: "DA",
  verkeer: "Verkeer",
  tfcf: "TF / CF",
  rd: "Verwijzende domeinen",
  maxlinks: "Max links",
  gesponsord: "Gesponsord",
  duur: "Duur",
  voorbeeld: "Voorbeeld",
};

function ColumnsMenu({ prefs, onChange }: { prefs: ColumnPrefs; onChange: (next: ColumnPrefs) => void }) {
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState<ColumnKey | null>(null);
  const [over, setOver] = useState<ColumnKey | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  const toggle = (key: ColumnKey) =>
    onChange({
      ...prefs,
      shown: prefs.shown.includes(key) ? prefs.shown.filter((c) => c !== key) : [...prefs.shown, key],
    });
  const move = (from: ColumnKey, to: ColumnKey) => onChange({ ...prefs, order: moveColumn(prefs.order, from, to) });
  const locked = (name: string) => (
    <div className="flex items-center gap-2.5 px-2 py-1.5 text-sm text-inkSoft">
      <span className="flex h-4 w-4 items-center justify-center rounded border border-line bg-gray-100">
        <Check size={12} strokeWidth={3} className="text-inkSoft/70" />
      </span>
      <span className="flex-1">{name}</span>
      <Lock size={13} className="text-inkSoft/70" />
    </div>
  );

  return (
    <div ref={ref} className="relative ml-auto hidden md:block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`flex h-10 items-center gap-2 rounded-xl border bg-surface px-3.5 text-sm font-medium text-ink transition ${
          open ? "border-[var(--btn-pay-bg)] ring-2 ring-[var(--pay-soft)]" : "border-line hover:bg-gray-50"
        }`}
      >
        <Columns3 size={16} className="text-inkSoft" />
        Kolommen
        <span className="rounded-full bg-gray-100 px-1.5 text-xs text-inkSoft">{prefs.shown.length + 2}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-30 w-64 rounded-xl border border-line bg-surface p-2 shadow-lg">
          <p className="px-2 pt-1 pb-1.5 text-xs text-inkSoft">
            Vink aan wat je wilt zien; sleep om de volgorde te wijzigen.
          </p>
          {locked("Domein")}
          <div className="max-h-[55vh] overflow-y-auto">
            {prefs.order.map((key, i) => {
              const on = prefs.shown.includes(key);
              return (
                <div
                  key={key}
                  draggable
                  onDragStart={(e) => {
                    setDragging(key);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (over !== key) setOver(key);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragging) move(dragging, key);
                    setDragging(null);
                    setOver(null);
                  }}
                  onDragEnd={() => {
                    setDragging(null);
                    setOver(null);
                  }}
                  className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-ink ${
                    dragging === key ? "opacity-40" : ""
                  } ${over === key && dragging && dragging !== key ? "bg-[var(--pay-soft)]" : "hover:bg-gray-50"}`}
                >
                  <button
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={on}
                    onClick={() => toggle(key)}
                    className="flex flex-1 items-center gap-2.5 text-left"
                  >
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded border ${
                        on ? "border-[var(--btn-pay-bg)] bg-[var(--btn-pay-bg)]" : "border-line"
                      }`}
                    >
                      {on && <Check size={12} strokeWidth={3} className="text-white" />}
                    </span>
                    {COLUMN_NAMES[key]}
                  </button>
                  <button
                    type="button"
                    aria-label={`${COLUMN_NAMES[key]} verplaatsen (pijltjes omhoog en omlaag)`}
                    title="Sleep om te verplaatsen"
                    onKeyDown={(e) => {
                      const to =
                        e.key === "ArrowUp" ? prefs.order[i - 1] : e.key === "ArrowDown" ? prefs.order[i + 1] : null;
                      if (!to) return;
                      e.preventDefault();
                      move(key, to);
                    }}
                    className="cursor-grab rounded p-0.5 text-inkSoft/70 hover:text-ink active:cursor-grabbing"
                  >
                    <GripVertical size={15} />
                  </button>
                </div>
              );
            })}
          </div>
          {locked("Prijs")}
          <div className="mt-2 border-t border-line px-2 pt-2 pb-1">
            <button
              type="button"
              onClick={() => onChange(DEFAULT_COLUMNS)}
              className="text-[13px] font-medium text-inkSoft underline underline-offset-2 hover:text-ink"
            >
              Standaard herstellen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MarketplaceTable({
  title,
  type,
  rows,
  pickedId,
  count,
  topic,
  topics,
  sort,
  page,
  totalPages,
  per,
  niches,
  countries,
  languages,
  initialColumns,
}: {
  title: string;
  type: "BLOG_POST" | "HOMEPAGE_LINK";
  rows: TableRow[];
  pickedId?: string;
  count: { shown: number; offered: number; accepting: number };
  topic: Option | null;
  topics: Option[];
  sort: SortKey;
  page: number;
  totalPages: number;
  per: number;
  niches: Option[];
  countries: Option[];
  languages: Option[];
  // The columns this customer chose (cookie), or the default.
  initialColumns: ColumnPrefs;
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

  const [columns, setColumnsState] = useState<ColumnPrefs>(initialColumns);
  function setColumns(next: ColumnPrefs) {
    setColumnsState(next);
    document.cookie = `${COLUMNS_COOKIE}=${serializeColumns(next)}; path=/; max-age=31536000; samesite=lax`;
    // A filter under a column that's now hidden would keep working unseen.
    const hidden = OPTIONAL_COLUMNS.filter((c) => !next.shown.includes(c)).flatMap((c) => COLUMN_FILTERS[c] ?? []);
    const active = hidden.filter((f) => get(f));
    if (active.length > 0) apply(Object.fromEntries(active.map((f) => [f, ""])));
  }

  const anyFilter = FILTER_KEYS.some((k) => get(k));
  const [filtersOpen, setFiltersOpen] = useState(false);
  // The visible width of the table: an opened row's details keep to it, so
  // with many columns they don't stretch off screen with the table.
  const scrollRef = useRef<HTMLDivElement>(null);
  const [viewWidth, setViewWidth] = useState<number | null>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setViewWidth(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const filterCount = FILTER_KEYS.filter((k) => k !== "q" && get(k)).length;
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
  const sortHeader = (label: string, key: SortKey, tipKey = label, align = "text-right", extra = "") => {
    const active = sort.split("-")[0] === key.split("-")[0];
    const Icon = !active ? ArrowUpDown : sort.endsWith("laag") ? ArrowUp : ArrowDown;
    return (
      <th className={`${th} ${align} ${extra}`}>
        <button
          type="button"
          onClick={() => apply({ sort: key }, false)}
          className={`inline-flex items-center gap-1 hover:text-ink ${active ? "text-ink" : "text-ink/80"}`}
        >
          {headerLabel(label, tipKey)}
          <Icon size={11} className={active ? "" : "text-inkSoft"} />
        </button>
      </th>
    );
  };
  const priceSort: SortKey = sort === "prijs-laag" ? "prijs-hoog" : "prijs-laag";
  const priceHeader = `Prijs${topic ? ` · ${topic.name}` : ""}`;

  const priceNote = (r: TableRow) => (r.periodic ? "per jaar" : null);
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
  const nicheChips = (r: TableRow) => <NicheChips niches={r.niches} />;
  const addButton = (r: TableRow) => (
    <AddToCartButton websiteProductId={r.websiteProductId} topicId={topic?.id ?? null} />
  );

  // The table's columns, in their fixed order: head (with its explanation),
  // the filter under it, and what a row shows.
  type Column = {
    key: ColumnKey | "domein" | "prijs";
    head: ReactNode;
    filter?: ReactNode;
    width?: string;
    cell: (r: TableRow) => ReactNode;
    cellClass?: string;
    stick?: "left" | "price";
  };
  const plainHead = (label: string, align = "", extra = "") => (
    <th className={`${th} ${align} ${extra}`}>{headerLabel(label)}</th>
  );
  const allColumns: Column[] = [
    {
      key: "domein",
      head: plainHead("Domein", "", `${STICKY.left} ${HEAD_BG}`),
      stick: "left",
      filter: typed("domain", "Zoeken", "left"),
      // The domain takes the room that's left, so "Voeg toe" stays next to the price.
      width: "min-w-[180px]",
      cellClass: "whitespace-nowrap",
      cell: (r) => (
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
      ),
    },
    {
      key: "niche",
      head: plainHead("Niche"),
      filter: picker("niche", "Niche", opts(niches)),
      width: "w-[140px]",
      cell: nicheChips,
    },
    {
      key: "land",
      head: plainHead("Land"),
      filter: picker("country", "Land", opts(countries)),
      width: "w-[120px]",
      cellClass: "whitespace-nowrap text-ink/80",
      cell: (r) => r.country,
    },
    {
      key: "taal",
      head: plainHead("Taal"),
      filter: picker("language", "Taal", opts(languages)),
      width: "w-[120px]",
      cellClass: "whitespace-nowrap text-ink/80",
      cell: (r) => r.language,
    },
    {
      key: "dr",
      head: sortHeader("DR", headerSort("dr", sort)),
      filter: typed("minDr", "≥"),
      width: "w-[72px]",
      cellClass: "text-right tabular-nums text-ink",
      cell: (r) => nl(r.domainRating),
    },
    {
      key: "da",
      head: sortHeader("DA", headerSort("da", sort)),
      filter: typed("minDa", "≥"),
      width: "w-[72px]",
      cellClass: "text-right tabular-nums text-ink/80",
      cell: (r) => nl(r.domainAuthority),
    },
    {
      key: "verkeer",
      head: sortHeader("Verkeer", headerSort("verkeer", sort)),
      filter: typed("minTraffic", "≥"),
      width: "w-[96px]",
      cellClass: "text-right tabular-nums text-ink/80",
      cell: (r) => nl(r.traffic),
    },
    {
      key: "tfcf",
      head: sortHeader("TF", headerSort("tf", sort)),
      width: "w-[64px]",
      cellClass: "text-right tabular-nums text-ink/80",
      cell: (r) => nl(r.trustFlow),
    },
    {
      key: "tfcf",
      head: sortHeader("CF", headerSort("cf", sort)),
      width: "w-[64px]",
      cellClass: "text-right tabular-nums text-ink/80",
      cell: (r) => nl(r.citationFlow),
    },
    {
      key: "rd",
      head: plainHead("Verw. domeinen", "text-right"),
      width: "w-[110px]",
      cellClass: "text-right tabular-nums text-ink/80",
      cell: (r) => nl(r.referringDomains),
    },
    {
      key: "maxlinks",
      head: plainHead("Max links", "text-center"),
      filter: typed("minLinks", "≥"),
      width: "w-[84px]",
      cellClass: "text-center tabular-nums text-ink/80",
      cell: (r) => nl(r.maxLinks),
    },
    {
      key: "gesponsord",
      head: plainHead("Gesponsord"),
      filter: picker("sponsored", "Gesponsord", [
        { value: "ja", name: "Ja" },
        { value: "nee", name: "Nee" },
      ]),
      width: "w-[100px]",
      cellClass: "text-ink/80",
      cell: (r) => (r.sponsored ? "Ja" : "Nee"),
    },
    {
      key: "duur",
      head: plainHead("Duur"),
      filter: picker("duur", "Duur", [
        { value: "permanent", name: "Permanent" },
        { value: "jaar", name: "Per jaar" },
      ]),
      width: "w-[112px]",
      cellClass: "whitespace-nowrap text-ink/80",
      cell: (r) => durationKindLabel(r.periodic),
    },
    {
      key: "voorbeeld",
      head: plainHead("Voorbeeld"),
      cellClass: "whitespace-nowrap",
      cell: example,
    },
    {
      key: "prijs",
      head: sortHeader(priceHeader, priceSort, "Prijs", "text-right", `${STICKY.price} ${HEAD_BG}`),
      stick: "price",
      filter: typed("maxPrice", "≤ max"),
      width: "w-[110px]",
      cellClass: "text-right whitespace-nowrap",
      cell: (r) => (
        <>
          <div className="font-semibold tabular-nums text-ink">{euro(r.price)}</div>
          {priceNote(r) && <div className="text-[11px] text-inkSoft">{priceNote(r)}</div>}
        </>
      ),
    },
  ];
  // Domein first, then the chosen columns in the chosen order, Prijs last.
  const columnsFor = (key: Column["key"]) => allColumns.filter((c) => c.key === key);
  const visible = [
    ...columnsFor("domein"),
    ...columns.order.filter((k) => columns.shown.includes(k)).flatMap(columnsFor),
    ...columnsFor("prijs"),
  ].map((c, i) => ({ ...c, id: `${c.key}-${i}` }));

  // Everything about a site, opened by clicking its row. "rows": on a phone,
  // niches and language as a list too, like Plaatsing and Cijfers above it.
  const details = (r: TableRow, rows = false) => (
    <div className="grid gap-6 md:grid-cols-2 md:gap-8 text-sm">
      {rows ? (
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-inkSoft">Over deze website</div>
          {r.description && <p className="mb-3 text-inkSoft">{r.description}</p>}
          <div className="flex items-center justify-between gap-3 border-b border-dashed border-line py-1.5">
            <span className="text-inkSoft">{r.niches.length === 1 ? "Niche" : "Niches"}</span>
            <span className="text-right text-ink">{r.niches.join(", ")}</span>
          </div>
          <div className="flex items-center justify-between gap-3 border-b border-dashed border-line py-1.5">
            <span className="text-inkSoft">Taal</span>
            <span className="flex items-center gap-2 text-ink">
              <CountryFlag code={r.countryCode} label={r.country} />
              {r.language}
            </span>
          </div>
        </div>
      ) : (
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-inkSoft">Over deze website</div>
          {r.description && <p className="mb-4 text-inkSoft">{r.description}</p>}
          <div className="mb-2 font-semibold text-ink">Niches</div>
          <div className="flex flex-wrap gap-1.5">
            {r.niches.map((n) => (
              <span key={n} className={`rounded-full px-3 py-1 ${NICHE_LABEL}`}>
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
      )}
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
          className="flex h-10 w-full items-center gap-2 rounded-xl border border-line bg-surface px-3.5 focus-within:ring-2 focus-within:ring-[var(--btn-pay-bg)] md:w-[380px]"
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
        {/* Right next to the search: what the link is about. Algemeen unless
            the customer picks a topic only some sites place, at their price
            for it; the other topics only show on opening it. */}
        <span className="relative inline-flex">
          <label
            className={`relative flex h-10 cursor-pointer items-center gap-1.5 rounded-xl bg-surface pl-3.5 text-sm focus-within:ring-2 focus-within:ring-[var(--btn-pay-bg)] ${
              topic ? "border-2 border-[var(--btn-pay-bg)] pr-16" : "border border-line pr-9"
            }`}
          >
            <span className="text-inkSoft">Prijzen voor:</span>
            <span className="font-semibold text-ink">{topic?.name ?? "Algemeen"}</span>
            <ChevronDown
              size={15}
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-inkSoft"
            />
            <select
              aria-label="Onderwerp van je link"
              value={topic?.id ?? ""}
              onChange={(e) => apply({ onderwerp: e.target.value })}
              className="absolute inset-0 cursor-pointer opacity-0"
            >
              <option value="">Algemeen</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          {/* Another topic than Algemeen: one tap back to the standard prices. */}
          {topic && (
            <button
              type="button"
              onClick={() => apply({ onderwerp: "" })}
              aria-label="Terug naar Algemeen"
              title="Terug naar Algemeen"
              className="absolute right-8 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-inkSoft hover:bg-gray-100 hover:text-ink"
            >
              <X size={14} />
            </button>
          )}
        </span>
        {anyFilter && (
          <button
            type="button"
            onClick={clearAll}
            className="text-[13px] font-medium text-inkSoft underline underline-offset-2 hover:text-ink"
          >
            Wis filters
          </button>
        )}
        <ColumnsMenu prefs={columns} onChange={setColumns} />

        {/* Phone: no filter row under the columns, so sorting and the filters
            that matter most sit behind two buttons. */}
        <div className="flex w-full gap-2 md:hidden">
          <label className={`${mobileChip(sort !== DEFAULT_SORT)} relative flex-1`}>
            <ArrowUpDown size={14} className="text-inkSoft" />
            <span className="truncate">{MOBILE_SORTS.find(([v]) => v === sort)?.[1] ?? "Sorteren"}</span>
            <ChevronDown size={14} className="ml-auto text-inkSoft" />
            <select
              aria-label="Sorteren"
              value={sort}
              onChange={(e) => apply({ sort: e.target.value === DEFAULT_SORT ? "" : e.target.value })}
              className="absolute inset-0 cursor-pointer opacity-0"
            >
              {MOBILE_SORTS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            aria-expanded={filtersOpen}
            className={`${mobileChip(filtersOpen || filterCount > 0)} flex-1`}
          >
            <SlidersHorizontal size={14} className="text-inkSoft" />
            Filters{filterCount > 0 && ` · ${filterCount}`}
            <ChevronDown
              size={14}
              className={`ml-auto text-inkSoft transition-transform ${filtersOpen ? "rotate-180" : ""}`}
            />
          </button>
        </div>
        {filtersOpen && (
          <div className="grid w-full grid-cols-2 gap-3 rounded-xl border border-line bg-surface p-3.5 md:hidden">
            {(
              [
                ["Niche", picker("niche", "Niche", opts(niches))],
                ["Land", picker("country", "Land", opts(countries))],
                ["DR vanaf", typed("minDr", "≥")],
                ["Verkeer vanaf", typed("minTraffic", "≥")],
                ["Prijs tot", typed("maxPrice", "≤ max")],
                [
                  "Duur",
                  picker("duur", "Duur", [
                    { value: "permanent", name: "Permanent" },
                    { value: "jaar", name: "Per jaar" },
                  ]),
                ],
              ] as [string, ReactNode][]
            ).map(([label, field]) => (
              <label
                key={label}
                className="text-xs text-inkSoft [&_input]:h-10 [&_input]:text-sm [&_select]:h-10 [&_select]:text-sm"
              >
                {label}
                <div className="mt-1">{field}</div>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Desktop: the table, with a filter under every column. */}
      <div ref={scrollRef} className="mt-4 hidden overflow-x-auto rounded-xl border border-line bg-surface md:block">
        <table className="w-full text-sm" style={{ minWidth: Math.max(760, visible.length * 100 + 140) }}>
          <thead>
            <tr className="bg-gray-50">
              {visible.map((c) => (
                <Fragment key={c.id}>{c.head}</Fragment>
              ))}
              <th className={`${th} ${STICKY.add} ${HEAD_BG}`} />
            </tr>
            <tr className={FILTER_BG}>
              {visible.map((c) => (
                <td
                  key={c.id}
                  className={`${filterCell} ${c.width ?? ""} ${c.stick ? `${STICKY[c.stick]} ${FILTER_BG}` : ""}`}
                >
                  {c.filter}
                </td>
              ))}
              <td className={`${filterCell} ${STICKY.add} ${FILTER_BG}`} />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isOpen = open === r.websiteProductId;
              // brandSoft/20 and gray-50/60 over white, solid for the sticky cells.
              const rowBg = isOpen ? "bg-[#fcfdff]" : "bg-surface group-hover:bg-[#fbfcfd]";
              return (
                <Fragment key={r.websiteProductId}>
                  <tr
                    onClick={() => setOpen(isOpen ? null : r.websiteProductId)}
                    aria-expanded={isOpen}
                    className={`group cursor-pointer border-t border-line/70 ${isOpen ? "bg-brandSoft/20" : "hover:bg-gray-50/60"}`}
                  >
                    {visible.map((c) => (
                      <td
                        key={c.id}
                        className={`px-3 py-2.5 ${c.cellClass ?? ""} ${c.stick ? `${STICKY[c.stick]} ${rowBg}` : ""}`}
                      >
                        {c.cell(r)}
                      </td>
                    ))}
                    <td className={`px-3 py-2 text-right ${STICKY.add} ${rowBg}`} onClick={(e) => e.stopPropagation()}>
                      {addButton(r)}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-brandSoft/20">
                      <td colSpan={visible.length + 1} className="border-t border-line/70 p-0">
                        <div className="sticky left-0 px-5 py-5" style={viewWidth ? { width: viewWidth } : undefined}>
                          {details(r)}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={visible.length + 1}
                  className="border-t border-line px-5 py-10 text-center text-sm text-inkSoft"
                >
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
                className="px-4 py-3"
              >
                {/* The full domain on its own line; price and button under it.
                    A small arrow says the card opens. */}
                <div className="flex items-start justify-between gap-3">
                  <div className="break-all font-semibold text-ink">{r.domain}</div>
                  <ChevronDown
                    size={16}
                    aria-hidden
                    className={`mt-0.5 shrink-0 text-inkSoft transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-3">
                  {/* The main niche and DR, on one line that never wraps, so every
                      card is just as high and the prices line up. Looptijd and
                      the rest are in the details. */}
                  <div className="flex min-w-0 items-center gap-2 text-[13px] text-inkSoft">
                    <NicheChips niches={r.niches} fit />
                    <span className="shrink-0 whitespace-nowrap">DR {nl(r.domainRating)}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {/* A fixed width, right-aligned, so the prices line up from card to
                        card; "per jaar" hangs under it, so the price itself stays on
                        the line with DR. */}
                    <span className="relative w-[76px] text-right">
                      <span className="block whitespace-nowrap text-[15px] font-bold tabular-nums text-ink">
                        {euro(r.price)}
                      </span>
                      {priceNote(r) && (
                        <span className="absolute right-0 top-full whitespace-nowrap text-[11px] leading-none text-inkSoft">
                          {priceNote(r)}
                        </span>
                      )}
                    </span>
                    {/* Only the button does its own thing; the rest of the card opens it. */}
                    <span onClick={(e) => e.stopPropagation()}>{addButton(r)}</span>
                  </div>
                </div>
              </div>
              {isOpen && (
                <div className="rounded-b-xl border-t border-line bg-brandSoft/20 px-4 py-5">
                  {/* What the placement is, as a list like Cijfers (on a
                      computer these are columns in the table). */}
                  <div className="mb-6 text-sm">
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-inkSoft">
                      Plaatsing
                    </div>
                    {(
                      [
                        ["Max. links", nl(r.maxLinks)],
                        ["Gesponsord", r.sponsored ? "Ja" : "Nee"],
                        ["Looptijd", durationKindLabel(r.periodic)],
                        ["Voorbeeld", r.exampleUrl ? example(r) : "Op aanvraag"],
                      ] as [string, ReactNode][]
                    ).map(([label, value]) => (
                      <div
                        key={label}
                        className="flex items-center justify-between gap-3 border-b border-dashed border-line py-1.5"
                      >
                        <span className="text-inkSoft">{label}</span>
                        <span className="text-ink">{value}</span>
                      </div>
                    ))}
                  </div>
                  {details(r, true)}
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
