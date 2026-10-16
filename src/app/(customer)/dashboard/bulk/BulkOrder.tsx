"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ExternalLink, Minus, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { placeBulkOrderAction } from "./actions";

export type BulkSite = {
  id: string; // websiteProduct id
  domain: string;
  niche: string;
  country: string;
  dr: number | null;
  da: number | null;
  traffic: number | null;
  maxLinks: number;
  periodic: boolean;
  price: number;
};
export type BulkProject = { id: string; name: string };

type ArticleType = "write" | "self" | "later";

type Article = {
  id: string;
  siteId: string;
  projectId: string;
  type: ArticleType;
  anchor: string;
  url: string;
  secondLink: boolean;
  anchor2: string;
  url2: string;
};

const TYPE_LABEL: Record<ArticleType, string> = {
  write: "Wij schrijven",
  self: "Zelf aanleveren",
  later: "Later aanleveren",
};

// Optional columns the agency can show or hide, like the marketplace. Site,
// price and subtotal are always shown; these default to a calm, useful set.
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

const PROJECT_PALETTE = ["#b4791f", "#2563eb", "#7c3aed", "#0ea5e9", "#15803d", "#d9476b", "#0d9488", "#c2620f"];
const projectColor = (s: string) => PROJECT_PALETTE[Array.from(s).reduce((n, c) => n + c.charCodeAt(0), 0) % PROJECT_PALETTE.length];
const euro = (n: number) => `€ ${n.toLocaleString("nl-NL")}`;
const nl = (n: number | null) => (n === null ? "–" : n.toLocaleString("nl-NL"));

export default function BulkOrder({ sites, projects }: { sites: BulkSite[]; projects: BulkProject[] }) {
  const router = useRouter();
  const [step, setStep] = useState<"select" | "fill" | "review" | "done">("select");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ orderCount: number; articleCount: number } | null>(null);
  const [visible, setVisible] = useState<ColKey[]>(DEFAULT_VISIBLE);

  // Remember the chosen columns per browser (read after mount so server and
  // first client render match).
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(COLS_KEY);
      if (saved) {
        const keys = JSON.parse(saved) as string[];
        setVisible(COLUMNS.map((c) => c.key).filter((k) => keys.includes(k)));
      }
    } catch {
      // No stored choice — keep the defaults.
    }
  }, []);

  function toggleCol(key: ColKey) {
    setVisible((cur) => {
      const next = cur.includes(key) ? cur.filter((k) => k !== key) : COLUMNS.map((c) => c.key).filter((k) => cur.includes(k) || k === key);
      try {
        window.localStorage.setItem(COLS_KEY, JSON.stringify(next));
      } catch {
        // Not worth surfacing if storage is unavailable.
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
        built.push({ id: `${s.id}-${i}`, siteId: s.id, projectId: projects[0]?.id ?? "", type: "write", anchor: "", url: "", secondLink: false, anchor2: "", url2: "" });
      }
    }
    setArticles(built);
    setError(null);
    setStep("fill");
  }

  const updateArticle = (id: string, patch: Partial<Article>) => setArticles((list) => list.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const removeArticle = (id: string) => setArticles((list) => list.filter((a) => a.id !== id));
  const setAllProject = (projectId: string) => setArticles((list) => list.map((a) => ({ ...a, projectId })));
  const setAllType = (type: ArticleType) => setArticles((list) => list.map((a) => ({ ...a, type })));

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

  const inputCls = "w-full border border-line rounded-md px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand";
  const selCls = "border border-line rounded-md px-2.5 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand";

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
          siteById={siteById}
          inputCls={inputCls}
          selCls={selCls}
          onUpdate={updateArticle}
          onRemove={removeArticle}
          onSetAllProject={setAllProject}
          onSetAllType={setAllType}
          sum={articlesSum}
          onBack={() => setStep("select")}
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

function SelectStep({ sites, qty, setQ, visible, toggleCol, selectedArticles, selectedSum, onNext }: { sites: BulkSite[]; qty: Record<string, number>; setQ: (id: string, v: number) => void; visible: ColKey[]; toggleCol: (k: ColKey) => void; selectedArticles: number; selectedSum: number; onNext: () => void }) {
  const [colsOpen, setColsOpen] = useState(false);
  const shown = COLUMNS.filter((c) => visible.includes(c.key));
  if (sites.length === 0) {
    return <div className="rounded-xl border border-line bg-surface p-8 text-center text-sm text-inkSoft">Er zijn op dit moment geen blog-sites beschikbaar.</div>;
  }
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-inkSoft">
          Kies per site hoeveel <span className="font-medium text-ink">artikelen</span> je wilt. Binnen een artikel mag je tot
          &ldquo;max. links&rdquo; links verwerken.
        </p>
        <div className="relative">
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
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-semibold text-inkSoft">
              <th className="px-4 py-3">Aantal artikelen</th>
              <th className="px-4 py-3">Site</th>
              {shown.map((c) => <th key={c.key} className="px-4 py-3">{c.label}</th>)}
              <th className="px-4 py-3">Prijs p/artikel</th>
              <th className="px-4 py-3 text-right">Subtotaal</th>
            </tr>
          </thead>
          <tbody>
            {sites.map((s) => {
              const n = qty[s.id] ?? 0;
              return (
                <tr key={s.id} className={`border-t border-line text-sm ${n > 0 ? "bg-emerald-50/40" : ""}`}>
                  <td className="px-4 py-3">
                    <div className={`inline-flex items-center overflow-hidden rounded-lg border ${n > 0 ? "border-[var(--btn-pay-bg)]" : "border-line"}`}>
                      <button type="button" onClick={() => setQ(s.id, n - 1)} className="flex h-8 w-8 items-center justify-center text-inkSoft hover:bg-gray-50"><Minus size={14} /></button>
                      <span className={`w-8 text-center text-sm font-bold tabular-nums ${n > 0 ? "text-[var(--btn-pay-bg)]" : "text-inkSoft/50"}`}>{n}</span>
                      <button type="button" onClick={() => setQ(s.id, n + 1)} className="flex h-8 w-8 items-center justify-center text-inkSoft hover:bg-gray-50"><Plus size={14} /></button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-ink">{s.domain}</span>
                      <a href={`https://${s.domain}`} target="_blank" rel="noreferrer" className="text-inkSoft/60 hover:text-ink" aria-label={`Open ${s.domain}`}><ExternalLink size={13} /></a>
                    </div>
                  </td>
                  {shown.map((c) => <td key={c.key} className="px-4 py-3">{cell(s, c.key)}</td>)}
                  <td className="px-4 py-3 font-semibold tabular-nums">{euro(s.price)}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{n > 0 ? euro(n * s.price) : <span className="text-inkSoft/40">—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
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

function FillStep({ articles, projects, noProjects, siteById, inputCls, selCls, onUpdate, onRemove, onSetAllProject, onSetAllType, sum, onBack, onNext }: { articles: Article[]; projects: BulkProject[]; noProjects: boolean; siteById: (id: string) => BulkSite; inputCls: string; selCls: string; onUpdate: (id: string, patch: Partial<Article>) => void; onRemove: (id: string) => void; onSetAllProject: (projectId: string) => void; onSetAllType: (type: ArticleType) => void; sum: number; onBack: () => void; onNext: () => void }) {
  const projectCount = new Set(articles.map((a) => a.projectId)).size;
  return (
    <>
      <p className="mb-3 text-sm text-inkSoft">Kies per artikel het project (= jouw klant) en vul de link(s) in. Een site met 2 links kan een tweede link in hetzelfde artikel krijgen.</p>

      {!noProjects && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
          <span className="font-semibold">⚡ Snel invullen:</span>
          <span>alles op</span>
          <select onChange={(e) => e.target.value && onSetAllProject(e.target.value)} defaultValue="" className="rounded-md border border-emerald-300 bg-white px-2 py-1 text-xs font-semibold text-emerald-900">
            <option value="" disabled>project…</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <span>en</span>
          <select onChange={(e) => e.target.value && onSetAllType(e.target.value as ArticleType)} defaultValue="" className="rounded-md border border-emerald-300 bg-white px-2 py-1 text-xs font-semibold text-emerald-900">
            <option value="" disabled>artikel…</option>
            <option value="write">Wij schrijven</option>
            <option value="self">Zelf aanleveren</option>
            <option value="later">Later aanleveren</option>
          </select>
        </div>
      )}

      <div className="space-y-2">
        {articles.map((a) => {
          const site = siteById(a.siteId);
          return (
            <div key={a.id} className="rounded-xl border border-line bg-surface p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-ink">{site.domain}</span>
                <span className="text-xs text-inkSoft">· max {site.maxLinks} {site.maxLinks === 1 ? "link" : "links"} · {euro(site.price)}</span>
                <select value={a.projectId} onChange={(e) => onUpdate(a.id, { projectId: e.target.value })} className={`${selCls} ml-auto`}>
                  {noProjects && <option value="">— geen project —</option>}
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select value={a.type} onChange={(e) => onUpdate(a.id, { type: e.target.value as ArticleType })} className={selCls}>
                  <option value="write">Wij schrijven</option>
                  <option value="self">Zelf aanleveren</option>
                  <option value="later">Later aanleveren</option>
                </select>
                <button type="button" onClick={() => onRemove(a.id)} className="text-inkSoft hover:text-red-600" aria-label="Verwijderen"><Trash2 size={16} /></button>
              </div>

              {a.type !== "later" && (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <input className={inputCls} placeholder="Ankertekst" value={a.anchor} onChange={(e) => onUpdate(a.id, { anchor: e.target.value })} />
                  <input className={inputCls} placeholder="Doel-URL (https://…)" value={a.url} onChange={(e) => onUpdate(a.id, { url: e.target.value })} />
                  {site.maxLinks > 1 && !a.secondLink && (
                    <button type="button" onClick={() => onUpdate(a.id, { secondLink: true })} className="justify-self-start text-xs font-semibold text-brand hover:underline">+ Tweede link in dit artikel</button>
                  )}
                  {site.maxLinks > 1 && a.secondLink && (
                    <>
                      <input className={inputCls} placeholder="Ankertekst 2" value={a.anchor2} onChange={(e) => onUpdate(a.id, { anchor2: e.target.value })} />
                      <input className={inputCls} placeholder="Doel-URL 2" value={a.url2} onChange={(e) => onUpdate(a.id, { url2: e.target.value })} />
                    </>
                  )}
                </div>
              )}
              {a.type === "later" && <p className="mt-2 text-xs text-inkSoft">Je vult dit artikel later in onder Mijn orders.</p>}
            </div>
          );
        })}
      </div>

      <div className="mt-3">
        <Link href="/dashboard/projects" className="text-sm font-semibold text-brand hover:underline">+ Nieuw project aanmaken</Link>
      </div>

      <div className="mt-4 flex flex-col items-stretch gap-3 rounded-xl border border-[#e3d9c2] bg-[#f0ebe0] px-5 py-4 text-[#3f3a2f] sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm">
          <span className="font-extrabold">{articles.length} artikelen</span> · {projectCount} {projectCount === 1 ? "project" : "projecten"} · samen {euro(sum)} · op rekening
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onBack} className="rounded-full border border-[#d8ccb0] px-4 py-2.5 text-sm font-semibold text-[#6b6450]">&larr; Terug</button>
          <button type="button" disabled={articles.length === 0} onClick={onNext} className="btn-pay rounded-full px-5 py-2.5 text-sm font-semibold transition disabled:opacity-40">Controleren &amp; bestellen &rarr;</button>
        </div>
      </div>
    </>
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
                <span className="h-3 w-3 rounded-sm" style={{ background: project ? projectColor(project.name) : "#999" }} />
                {project?.name ?? "Geen project"}
                <span className="ml-auto text-xs font-semibold text-inkSoft">{group.length} artikelen · {euro(groupSum)}</span>
              </div>
              {group.map((a) => {
                const site = siteById(a.siteId);
                return (
                  <div key={a.id} className="flex items-center gap-3 border-b border-line px-4 py-3 text-sm last:border-b-0">
                    <div className="min-w-0">
                      <div className="font-semibold text-ink">{site.domain}</div>
                      <div className="truncate text-xs text-inkSoft">{a.type === "later" ? "nog in te vullen" : `${a.anchor || "ankertekst"} → ${a.url || "doel-URL"}`}{a.secondLink && a.anchor2 ? ` · + ${a.anchor2}` : ""}</div>
                    </div>
                    <span className="ml-auto rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-inkSoft">{TYPE_LABEL[a.type]}</span>
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
      <p className="mx-auto mt-3 max-w-md rounded-lg border border-[#ecdfbc] bg-[#fbf7ec] px-4 py-2 text-sm text-[#8a5a12]">Dit komt op je verzamelfactuur. Je vindt de orders onder Mijn orders.</p>
      <Link href="/dashboard/orders" className="btn-pay mt-6 inline-block rounded-full px-5 py-2.5 text-sm font-semibold transition">Naar mijn orders →</Link>
    </div>
  );
}
