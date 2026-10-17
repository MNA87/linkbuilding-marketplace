"use client";

import { Fragment, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, ExternalLink, Minus, Plus, SlidersHorizontal, Trash2, X } from "lucide-react";
import CountryFlag from "@/components/CountryFlag";
import RichTextEditor from "@/components/RichTextEditor";
import DatePicker from "@/components/DatePicker";
import { durationKindLabel } from "@/lib/placementPeriod";
import { placeBulkOrderAction, createBulkProjectAction } from "./actions";

export type BulkSite = {
  id: string; // websiteProduct id
  domain: string;
  niche: string;
  niches: string[];
  country: string;
  countryCode: string;
  language: string;
  description: string | null;
  exampleUrl: string | null;
  sponsored: boolean;
  dr: number | null;
  da: number | null;
  trustFlow: number | null;
  citationFlow: number | null;
  traffic: number | null;
  referringDomains: number | null;
  ipAddress: string | null;
  behindCloudflare: boolean;
  aiCited: boolean | null;
  maxLinks: number;
  periodic: boolean;
  price: number;
};
export type BulkProject = { id: string; name: string };

type ArticleType = "write" | "self" | "later";

// Per article you choose who does what. "Laat ons schrijven" needs the links
// (anchor + URL) now; "Zelf aanleveren" takes a Google Doc link now (full text
// can also be delivered later per article); "Later aanleveren" defers all
// content until after the order. Everything is on account.
type Article = {
  id: string;
  siteId: string;
  projectId: string;
  type: ArticleType | ""; // "" = nog niet gekozen
  anchor: string;
  url: string;
  secondLink: boolean;
  anchor2: string;
  url2: string;
  // "Zelf aanleveren": either a Google Doc link or pasted text (selfText).
  selfText: boolean;
  docUrl: string;
  body: string;
  publishOn: string; // "" = zo snel mogelijk
};

const TYPE_LABEL: Record<ArticleType, string> = {
  write: "Laat ons schrijven",
  self: "Zelf aanleveren",
  later: "Later aanleveren",
};

type ColKey = "niche" | "country" | "dr" | "da" | "traffic" | "maxLinks" | "duur";
const COLUMNS: { key: ColKey; label: string }[] = [
  { key: "niche", label: "Niche" },
  { key: "country", label: "Land" },
  { key: "dr", label: "DR" },
  { key: "da", label: "DA" },
  { key: "traffic", label: "Verkeer" },
  { key: "maxLinks", label: "Max. links" },
  { key: "duur", label: "Duur" },
];
const DEFAULT_VISIBLE: ColKey[] = ["niche", "dr", "maxLinks"];
const COLS_KEY = "nugevonden-bulk-columns";
// Keeps the step + selection + filled-in rows through a page refresh.
const DRAFT_KEY = "nugevonden-bulk-draft";

const euro = (n: number) => `€ ${n.toLocaleString("nl-NL")}`;
const nl = (n: number | null) => (n === null ? "–" : n.toLocaleString("nl-NL"));
const dayLabel = (d: string) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("nl-NL", { day: "numeric", month: "short" }) : "zo snel mogelijk");

// Light fields with a thin border — the calmer "variant A" look.
const fieldCls = "w-full rounded-md border border-line bg-white px-2.5 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand";
const pickCls = "w-full rounded-md border border-line bg-white px-2 py-2 text-sm font-medium text-ink focus:outline-none focus:ring-2 focus:ring-brand";

export default function BulkOrder({ sites, projects: initialProjects, schedule }: { sites: BulkSite[]; projects: BulkProject[]; schedule: { min: string; max: string } }) {
  const router = useRouter();
  // Projects can grow while you fill in a bulk order (a new client added
  // inline), so they live in state rather than staying a fixed prop.
  const [projects, setProjects] = useState<BulkProject[]>(initialProjects);
  const addProject = (p: BulkProject) =>
    setProjects((cur) => (cur.some((x) => x.id === p.id) ? cur : [...cur, p]));
  const [step, setStep] = useState<"select" | "fill" | "review" | "done">("select");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ orderCount: number; articleCount: number } | null>(null);
  const [visible, setVisible] = useState<ColKey[]>(DEFAULT_VISIBLE);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(COLS_KEY);
      if (saved) {
        const keys = JSON.parse(saved) as string[];
        setVisible(COLUMNS.map((c) => c.key).filter((k) => keys.includes(k)));
      }
    } catch {
      // Keep the defaults.
    }
  }, []);

  // Restore an unfinished bulk order after a refresh (step + selection + rows).
  // Read after mount so server and first client render still match.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const d = JSON.parse(saved) as { step?: string; qty?: Record<string, number>; articles?: Article[] };
        const rows = (d.articles ?? [])
          .filter((a) => sites.some((s) => s.id === a.siteId))
          .map((a) => ({ ...a, selfText: a.selfText ?? false, docUrl: a.docUrl ?? "", body: a.body ?? "", projectId: projects.some((p) => p.id === a.projectId) ? a.projectId : "" }));
        if (d.qty) setQty(d.qty);
        if (rows.length) setArticles(rows);
        if ((d.step === "fill" || d.step === "review") && rows.length) setStep(d.step);
      }
    } catch {
      // Corrupt or inaccessible storage — just start fresh.
    }
    setRestored(true);
    // Only on opening the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep that draft up to date — but not before the restore ran, or it would
  // overwrite a saved draft with the empty defaults. Cleared once placed.
  useEffect(() => {
    if (!restored) return;
    try {
      if (step === "done") window.localStorage.removeItem(DRAFT_KEY);
      else window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ step, qty, articles }));
    } catch {
      // Losing the autosave isn't worth surfacing an error for.
    }
  }, [restored, step, qty, articles]);

  function toggleCol(key: ColKey) {
    setVisible((cur) => {
      const next = cur.includes(key) ? cur.filter((k) => k !== key) : COLUMNS.map((c) => c.key).filter((k) => cur.includes(k) || k === key);
      try {
        window.localStorage.setItem(COLS_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }

  const siteById = (id: string) => sites.find((s) => s.id === id)!;
  const projectById = (id: string) => projects.find((p) => p.id === id);
  const noProjects = projects.length === 0;

  const selectedArticles = sites.reduce((n, s) => n + (qty[s.id] ?? 0), 0);
  const selectedSum = sites.reduce((n, s) => n + (qty[s.id] ?? 0) * s.price, 0);

  const setQ = (id: string, value: number) => setQty((q) => ({ ...q, [id]: Math.max(0, value) }));

  function goToFill() {
    const built: Article[] = [];
    for (const s of sites) {
      const n = qty[s.id] ?? 0;
      for (let i = 0; i < n; i++) {
        // No default project on purpose: you must pick one per row, so nothing
        // lands on the wrong client by accident.
        built.push({ id: `${s.id}-${i}`, siteId: s.id, projectId: "", type: "", anchor: "", url: "", secondLink: false, anchor2: "", url2: "", selfText: false, docUrl: "", body: "", publishOn: "" });
      }
    }
    setArticles(built);
    setError(null);
    setStep("fill");
  }

  const updateArticle = (id: string, patch: Partial<Article>) => setArticles((list) => list.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const removeArticle = (id: string) => setArticles((list) => list.filter((a) => a.id !== id));

  // Going back to "Kiezen" should mirror what you just did while filling in:
  // rows removed there drop the per-site count (a site with none left shows 0).
  function backToSelect() {
    const counts: Record<string, number> = {};
    for (const a of articles) counts[a.siteId] = (counts[a.siteId] ?? 0) + 1;
    setQty(counts);
    setStep("select");
  }
  const setAllProject = (projectId: string) => setArticles((list) => list.map((a) => ({ ...a, projectId })));
  const setAllType = (type: ArticleType) => setArticles((list) => list.map((a) => ({ ...a, type })));
  const setAllDate = (publishOn: string) => setArticles((list) => list.map((a) => ({ ...a, publishOn })));

  const articlesSum = articles.reduce((n, a) => n + siteById(a.siteId).price, 0);
  const usedProjectIds = Array.from(new Set(articles.map((a) => a.projectId)));

  async function place() {
    setError(null);
    setLoading(true);
    try {
      const res = await placeBulkOrderAction({
        articles: articles.map((a) => ({
          websiteProductId: a.siteId,
          projectId: a.projectId,
          type: a.type,
          anchor: a.anchor,
          url: a.url,
          anchor2: a.secondLink ? a.anchor2 : "",
          url2: a.secondLink ? a.url2 : "",
          docUrl: a.type === "self" ? a.docUrl : "",
          body: a.type === "self" ? a.body : "",
          publishOn: a.publishOn,
        })),
      });
      if (!res.success) {
        setError(res.error ?? "Er ging iets mis.");
        setLoading(false);
        return;
      }
      setResult({ orderCount: res.orderCount ?? usedProjectIds.length, articleCount: res.articleCount ?? articles.length });
      setStep("done");
      router.refresh();
    } catch {
      setError("Er ging iets mis. Probeer het opnieuw.");
      setLoading(false);
    }
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-serif text-2xl text-ink">Bulk bestellen</h1>
        <span className="rounded-full border border-[#e3d9c2] bg-[#f0ebe0] px-3 py-1 text-xs font-semibold text-[#3f3a2f]">
          Op rekening · verzamelfactuur
        </span>
      </div>

      <Stepper step={step} />

      {noProjects && step !== "done" && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Je hebt nog geen projecten. Maak er eerst één aan onder{" "}
          <Link href="/dashboard/projects" className="font-semibold underline">Projecten</Link> (één per klant).
        </div>
      )}

      {error && step !== "done" && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
      )}

      {step === "select" && (
        <SelectStep sites={sites} qty={qty} setQ={setQ} visible={visible} toggleCol={toggleCol} selectedArticles={selectedArticles} selectedSum={selectedSum} onNext={goToFill} />
      )}

      {step === "fill" && (
        <FillStep
          articles={articles}
          projects={projects}
          noProjects={noProjects}
          schedule={schedule}
          siteById={siteById}
          onUpdate={updateArticle}
          onRemove={removeArticle}
          onSetAllProject={setAllProject}
          onSetAllType={setAllType}
          onSetAllDate={setAllDate}
          onAddProject={addProject}
          sum={articlesSum}
          onBack={backToSelect}
          onNext={() => setStep("review")}
        />
      )}

      {step === "review" && (
        <ReviewStep
          articles={articles}
          usedProjectIds={usedProjectIds}
          projectById={projectById}
          siteById={siteById}
          sum={articlesSum}
          loading={loading}
          canPlace={!noProjects && articles.every((a) => a.projectId)}
          onBack={() => setStep("fill")}
          onPlace={place}
        />
      )}

      {step === "done" && result && <DoneStep articleCount={result.articleCount} orderCount={result.orderCount} sum={articlesSum} />}
    </div>
  );
}

function Stepper({ step }: { step: string }) {
  const steps = [
    { key: "select", label: "Kiezen" },
    { key: "fill", label: "Invullen" },
    { key: "review", label: "Controleren" },
  ];
  const order = ["select", "fill", "review", "done"];
  const current = order.indexOf(step);
  return (
    <ol className="mb-6 flex items-center">
      {steps.map((s, i) => {
        const idx = order.indexOf(s.key);
        const done = idx < current;
        const active = idx === current;
        return (
          <li key={s.key} className={`flex items-center ${i < steps.length - 1 ? "flex-1" : ""}`}>
            <span className="flex items-center gap-2">
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${done ? "bg-[var(--btn-pay-bg)] text-white" : active ? "border-2 border-[var(--btn-pay-bg)] bg-white text-[var(--btn-pay-bg)]" : "bg-gray-200 text-inkSoft"}`}>
                {done ? <Check size={15} strokeWidth={3} /> : i + 1}
              </span>
              <span className={`text-sm font-semibold ${done || active ? "text-ink" : "text-inkSoft/70"}`}>{s.label}</span>
            </span>
            {i < steps.length - 1 && <span className={`mx-3 h-0.5 flex-1 rounded ${done ? "bg-[var(--btn-pay-bg)]" : "bg-line"}`} />}
          </li>
        );
      })}
    </ol>
  );
}

function cell(s: BulkSite, key: ColKey) {
  switch (key) {
    case "niche":
      return <span className="rounded-full bg-[#eff3f0] px-2.5 py-0.5 text-xs font-medium text-[#5b7266]">{s.niche}</span>;
    case "country":
      return <span className="text-inkSoft">{s.country}</span>;
    case "dr":
      return <span className="tabular-nums">{nl(s.dr)}</span>;
    case "da":
      return <span className="tabular-nums">{nl(s.da)}</span>;
    case "traffic":
      return <span className="tabular-nums">{nl(s.traffic)}</span>;
    case "maxLinks":
      return <span className="text-xs font-medium text-inkSoft">{s.maxLinks} {s.maxLinks === 1 ? "link" : "links"}</span>;
    case "duur":
      return <span className="text-inkSoft">{s.periodic ? "Per jaar" : "Permanent"}</span>;
  }
}

// The full detail block for one site — the same info as the marketplace
// (Over deze website / Plaatsing / Cijfers), shown under a row on request.
function SiteDetails({ s }: { s: BulkSite }) {
  const Row = ({ label, value }: { label: ReactNode; value: ReactNode }) => (
    <div className="flex items-center justify-between gap-3 border-b border-dashed border-line py-1.5">
      <span className="text-inkSoft">{label}</span>
      <span className="text-right text-ink">{value}</span>
    </div>
  );
  const cijfers: [string, string][] = [
    ["Domain Rating (DR)", nl(s.dr)],
    ["Domain Authority (DA)", nl(s.da)],
    ["Trust Flow (TF)", nl(s.trustFlow)],
    ["Citation Flow (CF)", nl(s.citationFlow)],
    ["Verkeer per maand", nl(s.traffic)],
    ["Verwijzende domeinen", nl(s.referringDomains)],
    ...(s.ipAddress ? ([["IP-adres", s.behindCloudflare ? `${s.ipAddress} (Cloudflare)` : s.ipAddress]] as [string, string][]) : []),
    ...(s.aiCited !== null ? ([["AI-Cited", s.aiCited ? "Ja" : "Nee"]] as [string, string][]) : []),
  ];
  return (
    <div className="grid gap-5 text-sm sm:grid-cols-3">
      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-inkSoft">Over deze website</div>
        {s.description && <p className="mb-3 text-inkSoft">{s.description}</p>}
        <Row label={s.niches.length === 1 ? "Niche" : "Niches"} value={s.niches.join(", ") || "—"} />
        <Row label="Taal" value={<span className="flex items-center justify-end gap-2">{s.countryCode && <CountryFlag code={s.countryCode} label={s.country} />}{s.language}</span>} />
      </div>
      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-inkSoft">Plaatsing</div>
        <Row label="Max. links" value={nl(s.maxLinks)} />
        <Row label="Gesponsord" value={s.sponsored ? "Ja" : "Nee"} />
        <Row label="Looptijd" value={durationKindLabel(s.periodic)} />
        <Row label="Voorbeeld" value={s.exampleUrl ? <a href={s.exampleUrl} target="_blank" rel="noreferrer" className="text-brand hover:underline">bekijk ↗</a> : "Op aanvraag"} />
      </div>
      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-inkSoft">Cijfers</div>
        {cijfers.map(([label, value]) => <Row key={label} label={label} value={value} />)}
      </div>
    </div>
  );
}

function SelectStep({ sites, qty, setQ, visible, toggleCol, selectedArticles, selectedSum, onNext }: { sites: BulkSite[]; qty: Record<string, number>; setQ: (id: string, v: number) => void; visible: ColKey[]; toggleCol: (k: ColKey) => void; selectedArticles: number; selectedSum: number; onNext: () => void }) {
  const [colsOpen, setColsOpen] = useState(false);
  const [openDetails, setOpenDetails] = useState<Set<string>>(new Set());
  const toggleDetails = (id: string) =>
    setOpenDetails((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const shown = COLUMNS.filter((c) => visible.includes(c.key));

  // Filters — handy now, a must once there are many sites. They narrow what's
  // shown; a site you already picked keeps its count even when filtered away.
  const [search, setSearch] = useState("");
  const [niche, setNiche] = useState("");
  const [minDr, setMinDr] = useState("");
  const allNiches = Array.from(new Set(sites.flatMap((s) => s.niches))).sort((a, b) => a.localeCompare(b, "nl"));
  const q = search.trim().toLowerCase();
  const drMin = minDr ? Number(minDr) : null;
  const filtered = sites.filter(
    (s) =>
      (!q || s.domain.toLowerCase().includes(q)) &&
      (!niche || s.niches.includes(niche)) &&
      (drMin === null || (s.dr ?? -1) >= drMin)
  );
  const hasFilter = q !== "" || niche !== "" || minDr !== "";
  const resetFilters = () => { setSearch(""); setNiche(""); setMinDr(""); };
  const filterField = "rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand";

  if (sites.length === 0) {
    return <div className="rounded-xl border border-line bg-surface p-8 text-center text-sm text-inkSoft">Er zijn op dit moment geen blog-sites beschikbaar.</div>;
  }
  return (
    <>
      <p className="mb-3 text-sm text-inkSoft">
        Kies per site hoeveel <span className="font-medium text-ink">artikelen</span> je wilt. Binnen een artikel mag je tot
        &ldquo;max. links&rdquo; links verwerken.
      </p>

      {/* Filterbalk (zoek / niche / DR) links, Kolommen-knop rechts (desktop). */}
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Zoek op domein…" className={`${filterField} sm:w-52`} />
          <select value={niche} onChange={(e) => setNiche(e.target.value)} className={filterField}>
            <option value="">Alle niches</option>
            {allNiches.map((nm) => <option key={nm} value={nm}>{nm}</option>)}
          </select>
          <input type="number" inputMode="numeric" min={0} max={100} value={minDr} onChange={(e) => setMinDr(e.target.value)} placeholder="DR vanaf" className={`${filterField} sm:w-28`} />
          {hasFilter && (
            <button type="button" onClick={resetFilters} className="inline-flex items-center gap-1 text-sm text-inkSoft hover:text-ink"><X size={14} /> Wis</button>
          )}
        </div>
        <div className="relative hidden md:block">
          <button type="button" onClick={() => setColsOpen((o) => !o)} className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink hover:bg-gray-50">
            <SlidersHorizontal size={15} /> Kolommen <span className="font-semibold">{shown.length}</span>
          </button>
          {colsOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setColsOpen(false)} />
              <div className="absolute right-0 z-20 mt-1 w-52 rounded-xl border border-line bg-surface p-2 shadow-lg">
                {COLUMNS.map((c) => (
                  <label key={c.key} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-ink hover:bg-gray-50">
                    <input type="checkbox" checked={visible.includes(c.key)} onChange={() => toggleCol(c.key)} className="h-4 w-4 accent-[var(--btn-pay-bg)]" />
                    {c.label}
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="mb-3 rounded-xl border border-line bg-surface p-6 text-center text-sm text-inkSoft">
          Geen sites gevonden met deze filters. <button type="button" onClick={resetFilters} className="font-semibold text-brand hover:underline">Wis filters</button>
        </div>
      )}
      <div className="hidden overflow-x-auto rounded-xl border border-line bg-surface md:block">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-semibold text-inkSoft">
              <th className="px-4 py-3">Aantal artikelen</th>
              <th className="px-4 py-3">Site</th>
              {shown.map((c) => <th key={c.key} className="px-4 py-3">{c.label}</th>)}
              <th className="px-4 py-3 text-right">Prijs p/artikel</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => {
              const n = qty[s.id] ?? 0;
              const open = openDetails.has(s.id);
              return (
                <Fragment key={s.id}>
                  {/* The whole row opens the details (like the marketplace); the
                      stepper and the visit link keep their own click. */}
                  <tr onClick={() => toggleDetails(s.id)} aria-expanded={open} className={`cursor-pointer border-t border-line text-sm hover:bg-gray-50/60 ${n > 0 ? "bg-emerald-50/40" : ""}`}>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className={`inline-flex items-center overflow-hidden rounded-lg border ${n > 0 ? "border-[var(--btn-pay-bg)]" : "border-line"}`}>
                        <button type="button" onClick={() => setQ(s.id, n - 1)} className="flex h-8 w-8 items-center justify-center text-inkSoft hover:bg-gray-50"><Minus size={14} /></button>
                        <span className={`w-8 text-center text-sm font-bold tabular-nums ${n > 0 ? "text-[var(--btn-pay-bg)]" : "text-inkSoft/50"}`}>{n}</span>
                        <button type="button" onClick={() => setQ(s.id, n + 1)} className="flex h-8 w-8 items-center justify-center text-inkSoft hover:bg-gray-50"><Plus size={14} /></button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-ink">{s.domain}</span>
                        <a onClick={(e) => e.stopPropagation()} href={`https://${s.domain}`} target="_blank" rel="noreferrer" className="text-inkSoft/60 hover:text-ink" aria-label={`Open ${s.domain}`}><ExternalLink size={13} /></a>
                      </div>
                    </td>
                    {shown.map((c) => <td key={c.key} className="px-4 py-3">{cell(s, c.key)}</td>)}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="font-semibold tabular-nums">{euro(s.price)}</span>
                        <ChevronDown size={16} className={`shrink-0 text-inkSoft/50 transition-transform ${open ? "rotate-180" : ""}`} />
                      </div>
                    </td>
                  </tr>
                  {open && (
                    <tr>
                      <td colSpan={shown.length + 3} className="border-t border-line bg-brandSoft/20 px-4 py-4">
                        <SiteDetails s={s} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: a card per site with the price and running subtotal up front. */}
      <div className="space-y-2.5 md:hidden">
        {filtered.map((s) => {
          const n = qty[s.id] ?? 0;
          return (
            <div key={s.id} className={`rounded-xl border bg-surface p-3 ${n > 0 ? "border-[var(--btn-pay-bg)]/40" : "border-line"}`}>
              {/* Two tight rows: domain + price + chevron up top (tap to open
                  details, like the regular marketplace), niche/DR next to the
                  stepper below. The visit link and stepper keep their own tap. */}
              <div
                role="button"
                tabIndex={0}
                aria-expanded={openDetails.has(s.id)}
                onClick={() => toggleDetails(s.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleDetails(s.id); } }}
                className="flex cursor-pointer items-center justify-between gap-2"
              >
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="break-all font-semibold text-ink">{s.domain}</span>
                  <a onClick={(e) => e.stopPropagation()} href={`https://${s.domain}`} target="_blank" rel="noreferrer" className="shrink-0 text-inkSoft/60 hover:text-ink" aria-label={`Open ${s.domain}`}><ExternalLink size={12} /></a>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="font-bold tabular-nums text-ink">{euro(s.price)}</span>
                  <ChevronDown size={16} aria-hidden className={`text-inkSoft transition-transform ${openDetails.has(s.id) ? "rotate-180" : ""}`} />
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2 text-xs text-inkSoft">
                  <span className="rounded-full bg-[#eff3f0] px-2 py-0.5 font-medium text-[#5b7266]">{s.niche}</span>
                  {s.dr !== null && <span className="shrink-0 whitespace-nowrap">DR {s.dr}</span>}
                </div>
                <div className={`inline-flex shrink-0 items-center overflow-hidden rounded-lg border ${n > 0 ? "border-[var(--btn-pay-bg)]" : "border-line"}`}>
                  <button type="button" onClick={() => setQ(s.id, n - 1)} className="flex h-8 w-8 items-center justify-center text-inkSoft hover:bg-gray-50"><Minus size={15} /></button>
                  <span className={`w-8 text-center text-sm font-bold tabular-nums ${n > 0 ? "text-[var(--btn-pay-bg)]" : "text-inkSoft/50"}`}>{n}</span>
                  <button type="button" onClick={() => setQ(s.id, n + 1)} className="flex h-8 w-8 items-center justify-center text-inkSoft hover:bg-gray-50"><Plus size={15} /></button>
                </div>
              </div>
              {openDetails.has(s.id) && (
                <div className="mt-3 border-t border-line pt-3">
                  <SiteDetails s={s} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-col items-stretch gap-3 rounded-xl border border-[#e3d9c2] bg-[#f0ebe0] px-5 py-4 text-[#3f3a2f] sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm">
          <span className="font-extrabold">{selectedArticles} artikelen</span>
          {selectedArticles > 0 && <span> · samen {euro(selectedSum)}</span>}
        </div>
        <button type="button" disabled={selectedArticles === 0} onClick={onNext} className="btn-pay rounded-full px-5 py-2.5 text-sm font-semibold transition disabled:opacity-40">
          {selectedArticles} artikelen invullen &rarr;
        </button>
      </div>
    </>
  );
}

// A project dropdown with an inline "+ Nieuw project…" at the bottom: picking
// it swaps the select for a small name field so a new client can be added
// without leaving the bulk flow. The created project is handed back via
// onCreated (so it joins the list) and selected via onChange.
function ProjectSelect({
  value,
  projects,
  onChange,
  onCreated,
  className,
  allowEmpty = false,
  placeholder,
}: {
  value: string;
  projects: BulkProject[];
  onChange: (id: string) => void;
  onCreated: (p: BulkProject) => void;
  className: string;
  allowEmpty?: boolean;
  placeholder?: string;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setErr("Minimaal 2 tekens.");
      return;
    }
    setBusy(true);
    setErr(null);
    const res = await createBulkProjectAction(trimmed);
    setBusy(false);
    if (res.error || !res.project) {
      setErr(res.error ?? "Mislukt.");
      return;
    }
    onCreated(res.project);
    setCreating(false);
    setName("");
  }

  function cancel() {
    setCreating(false);
    setName("");
    setErr(null);
  }

  if (creating) {
    return (
      <div>
        <div className="flex items-center gap-1">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); void save(); }
              if (e.key === "Escape") cancel();
            }}
            placeholder="Naam nieuwe klant…"
            className={`${className} min-w-0 flex-1`}
          />
          <button type="button" onClick={() => void save()} disabled={busy} aria-label="Opslaan" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--btn-pay-bg)] text-white disabled:opacity-50">
            <Check size={15} />
          </button>
          <button type="button" onClick={cancel} aria-label="Annuleren" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line text-inkSoft hover:text-ink">
            <X size={15} />
          </button>
        </div>
        {err && <p className="mt-1 text-[11px] text-red-600">{err}</p>}
      </div>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => {
        if (e.target.value === "__new__") { setErr(null); setCreating(true); }
        else onChange(e.target.value);
      }}
      className={className}
    >
      {placeholder && (allowEmpty || value === "") && <option value="">{placeholder}</option>}
      {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      <option value="__new__">+ Nieuw project…</option>
    </select>
  );
}

function FillStep({ articles, projects, noProjects, schedule, siteById, onUpdate, onRemove, onSetAllProject, onSetAllType, onSetAllDate, onAddProject, sum, onBack, onNext }: { articles: Article[]; projects: BulkProject[]; noProjects: boolean; schedule: { min: string; max: string }; siteById: (id: string) => BulkSite; onUpdate: (id: string, patch: Partial<Article>) => void; onRemove: (id: string) => void; onSetAllProject: (projectId: string) => void; onSetAllType: (type: ArticleType) => void; onSetAllDate: (d: string) => void; onAddProject: (p: BulkProject) => void; sum: number; onBack: () => void; onNext: () => void }) {
  const projectCount = new Set(articles.filter((a) => a.projectId).map((a) => a.projectId)).size;
  const missingProject = articles.filter((a) => !a.projectId).length;
  const missingType = articles.filter((a) => !a.type).length;
  // "Laat ons schrijven" needs the link(s) we write around: anchor + doel-URL.
  const incompleteWrite = articles.filter((a) => a.type === "write" && !(a.anchor.trim() && a.url.trim())).length;
  const blocked = articles.length === 0 || missingProject > 0 || missingType > 0 || incompleteWrite > 0;
  // Which article's text is being typed in the pop-up editor (so the table
  // stays a clean flat overview and the full editor opens in a focused window).
  const [editing, setEditing] = useState<string | null>(null);
  const editArticle = editing ? articles.find((a) => a.id === editing) ?? null : null;
  const [quickDateMode, setQuickDateMode] = useState(false);
  // The date applied to all rows via "Snel invullen".
  const [quickDate, setQuickDate] = useState("");
  // What the project picker shows — so a chosen project stays visible instead of
  // snapping back to the placeholder.
  const [quickProject, setQuickProject] = useState("");
  const quickSel = "w-full rounded-md border border-emerald-300 bg-white px-2.5 py-2 text-sm font-semibold text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-400";
  const quickLbl = "mb-1 block text-[10px] font-bold uppercase tracking-wide text-emerald-700/80";
  return (
    <>
      <p className="mb-3 text-sm text-inkSoft">Kies per artikel het project, wie schrijft en wanneer het live gaat. Bij &ldquo;Laat ons schrijven&rdquo; geef je de link(s); bij &ldquo;Zelf aanleveren&rdquo; een Google Doc-link (volledige tekst kan ook later). &ldquo;Later aanleveren&rdquo; vul je helemaal na de bestelling in.</p>

      {!noProjects && (
        <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <div className="mb-2.5 flex items-center gap-1.5 text-sm font-semibold text-emerald-800">⚡ Snel invullen — op alle regels</div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div>
              <label className={quickLbl}>Project</label>
              <ProjectSelect
                value={quickProject}
                projects={projects}
                onChange={(id) => { setQuickProject(id); if (id) onSetAllProject(id); }}
                onCreated={(p) => { onAddProject(p); setQuickProject(p.id); onSetAllProject(p.id); }}
                className={quickSel}
                placeholder="Kies project…"
              />
            </div>
            <div>
              <label className={quickLbl}>Artikel</label>
              <select onChange={(e) => e.target.value && onSetAllType(e.target.value as ArticleType)} defaultValue="" className={quickSel}>
                <option value="" disabled>Kies…</option>
                <option value="write">Laat ons schrijven</option>
                <option value="self">Zelf aanleveren</option>
                <option value="later">Later aanleveren</option>
              </select>
            </div>
            <div>
              <label className={quickLbl}>Live op</label>
              <div className="space-y-1.5">
                <div className="flex rounded-md border border-emerald-300 bg-white p-0.5">
                  <button type="button" onClick={() => { setQuickDateMode(false); setQuickDate(""); onSetAllDate(""); }} className={`flex-1 whitespace-nowrap rounded px-2 py-1.5 text-xs font-semibold ${!quickDateMode ? "bg-emerald-600 text-white" : "text-emerald-900"}`}>Zo snel mogelijk</button>
                  <button type="button" onClick={() => { const d = quickDate || schedule.min; setQuickDate(d); onSetAllDate(d); setQuickDateMode(true); }} className={`flex-1 whitespace-nowrap rounded px-2 py-1.5 text-xs font-semibold ${quickDateMode ? "bg-emerald-600 text-white" : "text-emerald-900"}`}>Op datum</button>
                </div>
                {quickDateMode && <DatePicker value={quickDate || schedule.min} min={schedule.min} max={schedule.max} onChange={(d) => { setQuickDate(d); onSetAllDate(d); }} initiallyOpen />}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="hidden overflow-x-auto rounded-xl border border-line bg-surface md:block">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wide text-inkSoft">
              <th className="px-3 py-2.5">Website</th>
              <th className="px-3 py-2.5" colSpan={2}>Inhoud</th>
              <th className="px-3 py-2.5">Project</th>
              <th className="px-3 py-2.5">Artikel</th>
              <th className="px-3 py-2.5">Live op</th>
              <th className="px-3 py-2.5 text-right">Prijs</th>
              <th className="px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {articles.map((a, i) => {
              const site = siteById(a.siteId);
              return (
                <tr key={a.id} className="border-t border-line align-top text-sm">
                  <td className="whitespace-nowrap px-3 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold tabular-nums text-inkSoft/60">{i + 1}.</span>
                      <span className="font-semibold text-ink">{site.domain}</span>
                      <a href={`https://${site.domain}`} target="_blank" rel="noreferrer" className="text-inkSoft/60 hover:text-ink" aria-label={`Open ${site.domain}`}><ExternalLink size={12} /></a>
                    </div>
                  </td>
                  {!a.type ? (
                    <td className="px-3 py-3 text-xs text-inkSoft/70" colSpan={2}>Kies rechts bij <span className="font-semibold">Artikel</span> hoe je aanlevert.</td>
                  ) : a.type === "later" ? (
                    <td className="px-3 py-3 text-xs text-inkSoft" colSpan={2}>Alles vul je na de bestelling in onder Mijn orders.</td>
                  ) : a.type === "self" ? (
                    <td className="px-3 py-3" colSpan={2}>
                      {a.body ? (
                        <button type="button" onClick={() => setEditing(a.id)} className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800">✓ Tekst aangeleverd — bewerken</button>
                      ) : (
                        <>
                          <input className={fieldCls} placeholder="Google Doc-link (optioneel)" value={a.docUrl} onChange={(e) => onUpdate(a.id, { docUrl: e.target.value })} />
                          <button type="button" onClick={() => setEditing(a.id)} className="mt-1.5 text-[11px] font-semibold text-brand hover:underline">of tekst typen / plakken →</button>
                        </>
                      )}
                    </td>
                  ) : (
                    <>
                      <td className="px-3 py-3">
                        <input className={fieldCls} placeholder="Ankertekst" value={a.anchor} onChange={(e) => onUpdate(a.id, { anchor: e.target.value })} />
                        {site.maxLinks > 1 && a.secondLink && <input className={`${fieldCls} mt-1.5`} placeholder="Ankertekst 2" value={a.anchor2} onChange={(e) => onUpdate(a.id, { anchor2: e.target.value })} />}
                      </td>
                      <td className="px-3 py-3">
                        <input className={fieldCls} placeholder="https://…" value={a.url} onChange={(e) => onUpdate(a.id, { url: e.target.value })} />
                        {site.maxLinks > 1 && a.secondLink && <input className={`${fieldCls} mt-1.5`} placeholder="Doel-URL 2" value={a.url2} onChange={(e) => onUpdate(a.id, { url2: e.target.value })} />}
                        {site.maxLinks > 1 && (
                          <button type="button" onClick={() => onUpdate(a.id, { secondLink: !a.secondLink })} className="mt-1 text-[11px] font-semibold text-brand hover:underline">{a.secondLink ? "− tweede link" : "+ tweede link"}</button>
                        )}
                      </td>
                    </>
                  )}
                  <td className="w-[170px] min-w-[170px] px-3 py-3 align-top">
                    <ProjectSelect
                      value={a.projectId}
                      projects={projects}
                      onChange={(id) => onUpdate(a.id, { projectId: id })}
                      onCreated={(p) => { onAddProject(p); onUpdate(a.id, { projectId: p.id }); }}
                      className={pickCls}
                      allowEmpty
                      placeholder="Kies project…"
                    />
                  </td>
                  <td className="w-[200px] min-w-[200px] px-3 py-3 align-top">
                    <select value={a.type} onChange={(e) => onUpdate(a.id, { type: e.target.value as ArticleType })} className={pickCls}>
                      <option value="" disabled>Kies…</option>
                      <option value="write">Laat ons schrijven</option>
                      <option value="self">Zelf aanleveren</option>
                      <option value="later">Later aanleveren</option>
                    </select>
                  </td>
                  <td className="px-3 py-3 align-top">
                    {a.type === "later" ? <span className="text-xs text-inkSoft">na bestelling</span> : a.type ? <LiveOp value={a.publishOn} min={schedule.min} max={schedule.max} onChange={(v) => onUpdate(a.id, { publishOn: v })} /> : <span className="text-xs text-inkSoft/50">—</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right align-top text-base font-extrabold tabular-nums text-ink">{euro(site.price)}</td>
                  <td className="px-3 py-3 text-right align-top">
                    <button type="button" onClick={() => onRemove(a.id)} className="text-inkSoft hover:text-red-600" aria-label="Verwijderen"><Trash2 size={16} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: one readable card per article (everything stacked). */}
      <div className="space-y-3 md:hidden">
        {articles.map((a, i) => {
          const site = siteById(a.siteId);
          const lbl = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-inkSoft";
          return (
            <div key={a.id} className="rounded-xl border border-line bg-surface p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-[11px] font-bold text-inkSoft">{i + 1}</span>
                  <span className="font-semibold text-ink">{site.domain}</span>
                  <a href={`https://${site.domain}`} target="_blank" rel="noreferrer" className="text-inkSoft/60 hover:text-ink" aria-label={`Open ${site.domain}`}><ExternalLink size={12} /></a>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-base font-extrabold tabular-nums text-ink">{euro(site.price)}</span>
                  <button type="button" onClick={() => onRemove(a.id)} className="text-inkSoft hover:text-red-600" aria-label="Verwijderen"><Trash2 size={16} /></button>
                </div>
              </div>
              <div className="space-y-2">
                <div>
                  <label className={lbl}>Artikel</label>
                  <select value={a.type} onChange={(e) => onUpdate(a.id, { type: e.target.value as ArticleType })} className={pickCls}>
                    <option value="" disabled>Kies…</option>
                    <option value="write">Laat ons schrijven</option>
                    <option value="self">Zelf aanleveren</option>
                    <option value="later">Later aanleveren</option>
                  </select>
                </div>
                {a.type === "write" && (
                  <>
                    <div><label className={lbl}>Ankertekst</label><input className={fieldCls} placeholder="Ankertekst" value={a.anchor} onChange={(e) => onUpdate(a.id, { anchor: e.target.value })} /></div>
                    <div><label className={lbl}>Doel-URL</label><input className={fieldCls} placeholder="https://…" value={a.url} onChange={(e) => onUpdate(a.id, { url: e.target.value })} /></div>
                    {site.maxLinks > 1 && !a.secondLink && (
                      <button type="button" onClick={() => onUpdate(a.id, { secondLink: true })} className="text-[11px] font-semibold text-brand hover:underline">+ Tweede link in dit artikel</button>
                    )}
                    {site.maxLinks > 1 && a.secondLink && (
                      <>
                        <div><label className={lbl}>Ankertekst 2</label><input className={fieldCls} value={a.anchor2} onChange={(e) => onUpdate(a.id, { anchor2: e.target.value })} /></div>
                        <div><label className={lbl}>Doel-URL 2</label><input className={fieldCls} value={a.url2} onChange={(e) => onUpdate(a.id, { url2: e.target.value })} /></div>
                        <button type="button" onClick={() => onUpdate(a.id, { secondLink: false })} className="text-[11px] font-semibold text-inkSoft hover:underline">− tweede link</button>
                      </>
                    )}
                  </>
                )}
                {a.type === "self" && (
                  <div>
                    <label className={lbl}>Content</label>
                    {a.body ? (
                      <button type="button" onClick={() => setEditing(a.id)} className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800">✓ Tekst aangeleverd — bewerken</button>
                    ) : (
                      <>
                        <input className={fieldCls} placeholder="Google Doc-link (optioneel)" value={a.docUrl} onChange={(e) => onUpdate(a.id, { docUrl: e.target.value })} />
                        <button type="button" onClick={() => setEditing(a.id)} className="mt-1.5 text-[11px] font-semibold text-brand hover:underline">of tekst typen / plakken →</button>
                      </>
                    )}
                  </div>
                )}
                {a.type === "later" && <p className="text-xs text-inkSoft">Alles vul je na de bestelling in onder Mijn orders.</p>}
                <div>
                  <label className={lbl}>Project</label>
                  <ProjectSelect
                    value={a.projectId}
                    projects={projects}
                    onChange={(id) => onUpdate(a.id, { projectId: id })}
                    onCreated={(p) => { onAddProject(p); onUpdate(a.id, { projectId: p.id }); }}
                    className={pickCls}
                    allowEmpty
                    placeholder="Kies project…"
                  />
                </div>
                {(a.type === "write" || a.type === "self") && (
                  <div>
                    <label className={lbl}>Live op</label>
                    <LiveOp value={a.publishOn} min={schedule.min} max={schedule.max} onChange={(v) => onUpdate(a.id, { publishOn: v })} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>


      <div className="mt-4 flex flex-col items-stretch gap-3 rounded-xl border border-[#e3d9c2] bg-[#f0ebe0] px-5 py-4 text-[#3f3a2f] sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm">
          <span className="font-extrabold">{articles.length} artikelen</span> · {projectCount} {projectCount === 1 ? "project" : "projecten"} · samen {euro(sum)} · op rekening
          {missingType > 0 && (
            <div className="mt-1 text-xs font-semibold text-amber-700">Kies nog hoe je aanlevert bij {missingType} {missingType === 1 ? "regel" : "regels"}.</div>
          )}
          {missingProject > 0 && (
            <div className="mt-1 text-xs font-semibold text-amber-700">Kies nog een project bij {missingProject} {missingProject === 1 ? "regel" : "regels"}.</div>
          )}
          {incompleteWrite > 0 && (
            <div className="mt-1 text-xs font-semibold text-amber-700">Vul ankertekst en doel-URL in bij {incompleteWrite} {incompleteWrite === 1 ? "regel" : "regels"} met &ldquo;Laat ons schrijven&rdquo;.</div>
          )}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onBack} className="rounded-full border border-[#d8ccb0] px-4 py-2.5 text-sm font-semibold text-[#6b6450]">&larr; Terug</button>
          <button type="button" disabled={blocked} onClick={onNext} className="btn-pay rounded-full px-5 py-2.5 text-sm font-semibold transition disabled:opacity-40">Controleren &amp; bestellen &rarr;</button>
        </div>
      </div>

      {/* Tekst-editor in een pop-up — zelfde editor als de marktplaats, zodat de
          tabel een strak overzicht blijft. */}
      {editArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditing(null)}>
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-surface shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <h3 className="font-serif text-lg text-ink">Tekst voor {siteById(editArticle.siteId).domain}</h3>
              <button type="button" onClick={() => setEditing(null)} className="text-inkSoft hover:text-ink" aria-label="Sluiten"><X size={18} /></button>
            </div>
            <div className="overflow-y-auto p-5">
              <RichTextEditor value={editArticle.body} onChange={(html) => onUpdate(editArticle.id, { body: html })} placeholder="Plak of typ hier je artikel…" />
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-line px-5 py-3">
              <button type="button" onClick={() => { onUpdate(editArticle.id, { body: "" }); setEditing(null); }} className="text-sm font-semibold text-inkSoft hover:text-red-600">Wissen</button>
              <button type="button" onClick={() => setEditing(null)} className="btn-pay rounded-full px-5 py-2 text-sm font-semibold">Klaar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// "Live op": a compact chooser. "Op datum" shows the same calendar as the
// regular order form (a floating pop-up that opens straight away), so it never
// bloats the row.
function LiveOp({ value, min, max, onChange }: { value: string; min: string; max: string; onChange: (v: string) => void }) {
  const planned = value !== "";
  const seg = (active: boolean) =>
    `flex-1 whitespace-nowrap rounded px-2 py-1 text-[11px] font-medium transition-colors ${active ? "bg-brandSoft text-ink" : "text-inkSoft hover:text-ink"}`;
  return (
    <div className="space-y-1.5">
      <div role="radiogroup" aria-label="Wanneer live?" className="flex rounded-md border border-line p-0.5">
        <button type="button" role="radio" aria-checked={!planned} onClick={() => onChange("")} className={seg(!planned)}>Zo snel mogelijk</button>
        <button type="button" role="radio" aria-checked={planned} onClick={() => { if (!planned) onChange(min); }} className={seg(planned)}>Op datum</button>
      </div>
      {planned && <DatePicker value={value} min={min} max={max} onChange={onChange} initiallyOpen />}
    </div>
  );
}

function ReviewStep({ articles, usedProjectIds, projectById, siteById, sum, loading, canPlace, onBack, onPlace }: { articles: Article[]; usedProjectIds: string[]; projectById: (id: string) => BulkProject | undefined; siteById: (id: string) => BulkSite; sum: number; loading: boolean; canPlace: boolean; onBack: () => void; onPlace: () => void }) {
  return (
    <>
      <p className="mb-3 text-sm text-inkSoft">{articles.length} artikelen, gegroepeerd per project. Onder water: 1 order per project, samen op één verzamelfactuur.</p>
      <div className="space-y-3">
        {usedProjectIds.map((pid) => {
          const project = projectById(pid);
          const group = articles.filter((a) => a.projectId === pid);
          const groupSum = group.reduce((n, a) => n + siteById(a.siteId).price, 0);
          return (
            <div key={pid || "none"} className="overflow-hidden rounded-xl border border-line bg-surface">
              <div className="flex items-center gap-2 border-b border-line bg-gray-50 px-4 py-3 text-sm font-bold text-ink">
                {project?.name ?? "Geen project"}
                <span className="ml-auto text-xs font-semibold text-inkSoft">{group.length} artikelen · {euro(groupSum)}</span>
              </div>
              {group.map((a) => {
                const site = siteById(a.siteId);
                return (
                  <div key={a.id} className="flex items-center gap-3 border-b border-line px-4 py-3 text-sm last:border-b-0">
                    <div className="min-w-0">
                      <div className="font-semibold text-ink">{site.domain}</div>
                      <div className="truncate text-xs text-inkSoft">
                        {a.type === "later"
                          ? "alles na bestelling aanleveren"
                          : a.type === "self"
                            ? `${a.selfText ? "eigen tekst" : a.docUrl ? "Google Doc" : "zelf aanleveren"} · live op ${dayLabel(a.publishOn)}`
                            : `${a.anchor || "ankertekst"} → ${a.url || "doel-URL"}${a.secondLink && a.anchor2 ? ` · + ${a.anchor2}` : ""} · live op ${dayLabel(a.publishOn)}`}
                      </div>
                    </div>
                    <span className="ml-auto rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-inkSoft">{a.type ? TYPE_LABEL[a.type] : ""}</span>
                    <span className="min-w-[56px] text-right font-semibold tabular-nums">{euro(site.price)}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="mt-4 rounded-xl border border-[#ecdfbc] bg-[#fbf7ec] px-4 py-3 text-sm text-[#8a5a12]">🧾 Komt op je <span className="font-semibold">verzamelfactuur</span> — je hoeft nu niets te betalen.</div>

      <div className="mt-3 flex flex-col items-stretch gap-3 rounded-xl border border-line bg-surface px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-inkSoft">{articles.length} artikelen · {usedProjectIds.length} projecten · <span className="text-lg font-extrabold text-ink">{euro(sum)}</span> <span className="text-xs">excl. btw</span></div>
        <div className="flex gap-2">
          <button type="button" onClick={onBack} className="rounded-full border border-line px-4 py-2.5 text-sm font-semibold text-inkSoft">&larr; Terug</button>
          <button type="button" disabled={loading || !canPlace} onClick={onPlace} className="btn-pay rounded-full px-5 py-2.5 text-sm font-semibold transition disabled:opacity-50">{loading ? "Bezig…" : "Bestelling plaatsen →"}</button>
        </div>
      </div>
    </>
  );
}

function DoneStep({ articleCount, orderCount, sum }: { articleCount: number; orderCount: number; sum: number }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-6 py-10 text-center">
      <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"><Check size={32} strokeWidth={2.5} /></span>
      <h2 className="font-serif text-2xl text-ink">Bestelling geplaatst</h2>
      <p className="mt-1.5 text-inkSoft">{articleCount} artikelen in {orderCount} {orderCount === 1 ? "order" : "orders"} · {euro(sum)}</p>
      <p className="mx-auto mt-3 max-w-md rounded-lg border border-[#ecdfbc] bg-[#fbf7ec] px-4 py-2 text-sm text-[#8a5a12]">Komt op je verzamelfactuur. Artikelen met <span className="font-semibold">Later aanleveren</span> (of nog zonder content) vul je per stuk aan onder Mijn orders.</p>
      <Link href="/dashboard/orders" className="btn-pay mt-6 inline-block rounded-full px-5 py-2.5 text-sm font-semibold transition">Naar mijn orders →</Link>
    </div>
  );
}
