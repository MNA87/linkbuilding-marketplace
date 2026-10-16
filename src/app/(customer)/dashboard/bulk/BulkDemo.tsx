"use client";

import { useState } from "react";
import { Check, Minus, Plus, Trash2 } from "lucide-react";

// A self-contained preview of the agency bulk-order flow. Everything lives in
// local state and nothing is sent to the server — "Bestelling plaatsen" only
// shows a confirmation. Sample data stands in for the real marketplace so the
// flow can be judged without touching orders, pricing or the database.

type Site = {
  id: string;
  domain: string;
  niche: string;
  color: string;
  maxLinks: number;
  dr: number;
  traffic: number;
  price: number;
};

type Project = { id: string; name: string; color: string };

type ArticleType = "write" | "self" | "later";

type Article = {
  id: string;
  siteId: string;
  projectId: string;
  type: ArticleType;
  anchor: string;
  url: string;
  // Only for a site that allows 2 links: an optional second link in the
  // same article.
  secondLink: boolean;
  anchor2: string;
  url2: string;
};

const SITES: Site[] = [
  { id: "s1", domain: "enqueteplein.nl", niche: "Financiën", color: "#b4791f", maxLinks: 2, dr: 71, traffic: 3026, price: 199 },
  { id: "s2", domain: "nugevonden.nl", niche: "Lifestyle", color: "#2563eb", maxLinks: 2, dr: 28, traffic: 268, price: 149 },
  { id: "s3", domain: "tuinblog.nl", niche: "Wonen", color: "#7c3aed", maxLinks: 1, dr: 44, traffic: 5100, price: 175 },
  { id: "s4", domain: "sportnieuws24.nl", niche: "Sport", color: "#0ea5e9", maxLinks: 1, dr: 39, traffic: 1900, price: 160 },
  { id: "s5", domain: "a2f.nl", niche: "Lifestyle", color: "#15803d", maxLinks: 2, dr: 1, traffic: 0, price: 100 },
  { id: "s6", domain: "reismagazine.nl", niche: "Reizen", color: "#d9476b", maxLinks: 2, dr: 52, traffic: 8400, price: 185 },
];

const PROJECT_COLORS = ["#2563eb", "#d9476b", "#15803d", "#b4791f", "#7c3aed", "#0ea5e9"];

const INITIAL_PROJECTS: Project[] = [
  { id: "p1", name: "Klant A", color: "#2563eb" },
  { id: "p2", name: "Klant B", color: "#d9476b" },
  { id: "p3", name: "Klant C", color: "#15803d" },
];

const TYPE_LABEL: Record<ArticleType, string> = {
  write: "Wij schrijven",
  self: "Zelf aanleveren",
  later: "Later aanleveren",
};

const euro = (n: number) => `€ ${n.toLocaleString("nl-NL")}`;

export default function BulkDemo() {
  const [step, setStep] = useState<"select" | "fill" | "review" | "done">("select");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [articles, setArticles] = useState<Article[]>([]);

  const siteById = (id: string) => SITES.find((s) => s.id === id)!;
  const projectById = (id: string) => projects.find((p) => p.id === id);

  const selectedArticles = SITES.reduce((n, s) => n + (qty[s.id] ?? 0), 0);
  const selectedSum = SITES.reduce((n, s) => n + (qty[s.id] ?? 0) * s.price, 0);

  function setQ(id: string, value: number) {
    setQty((q) => ({ ...q, [id]: Math.max(0, value) }));
  }

  function goToFill() {
    const built: Article[] = [];
    for (const s of SITES) {
      const n = qty[s.id] ?? 0;
      for (let i = 0; i < n; i++) {
        built.push({
          id: `${s.id}-${i}`,
          siteId: s.id,
          projectId: projects[0]?.id ?? "",
          type: "write",
          anchor: "",
          url: "",
          secondLink: false,
          anchor2: "",
          url2: "",
        });
      }
    }
    setArticles(built);
    setStep("fill");
  }

  function updateArticle(id: string, patch: Partial<Article>) {
    setArticles((list) => list.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  function removeArticle(id: string) {
    setArticles((list) => list.filter((a) => a.id !== id));
  }

  function setAllProject(projectId: string) {
    setArticles((list) => list.map((a) => ({ ...a, projectId })));
  }
  function setAllType(type: ArticleType) {
    setArticles((list) => list.map((a) => ({ ...a, type })));
  }

  function addProject() {
    const name = window.prompt("Naam van het nieuwe project (bijv. de klant)")?.trim();
    if (!name) return;
    const id = `p${projects.length + 1}-${Date.now()}`;
    setProjects((list) => [...list, { id, name, color: PROJECT_COLORS[list.length % PROJECT_COLORS.length] }]);
  }

  const articlesSum = articles.reduce((n, a) => n + siteById(a.siteId).price, 0);
  const usedProjectIds = Array.from(new Set(articles.map((a) => a.projectId)));

  const inputCls = "w-full border border-line rounded-md px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand";
  const selCls = "border border-line rounded-md px-2.5 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand";

  return (
    <div className="max-w-5xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-serif text-2xl text-ink">Bulk bestellen</h1>
        <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
          Preview — plaatst nog geen echte bestelling
        </span>
      </div>

      <Stepper step={step} />

      {step === "select" && (
        <SelectStep
          qty={qty}
          setQ={setQ}
          selectedArticles={selectedArticles}
          selectedSum={selectedSum}
          onNext={goToFill}
        />
      )}

      {step === "fill" && (
        <FillStep
          articles={articles}
          projects={projects}
          siteById={siteById}
          inputCls={inputCls}
          selCls={selCls}
          onUpdate={updateArticle}
          onRemove={removeArticle}
          onSetAllProject={setAllProject}
          onSetAllType={setAllType}
          onAddProject={addProject}
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
          onBack={() => setStep("fill")}
          onPlace={() => setStep("done")}
        />
      )}

      {step === "done" && (
        <DoneStep articles={articles} projectCount={usedProjectIds.length} sum={articlesSum} onRestart={() => { setStep("select"); setQty({}); setArticles([]); }} />
      )}
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
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${
                  done
                    ? "bg-[var(--btn-pay-bg)] text-white"
                    : active
                      ? "border-2 border-[var(--btn-pay-bg)] bg-white text-[var(--btn-pay-bg)]"
                      : "bg-gray-200 text-inkSoft"
                }`}
              >
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

function SelectStep({
  qty,
  setQ,
  selectedArticles,
  selectedSum,
  onNext,
}: {
  qty: Record<string, number>;
  setQ: (id: string, v: number) => void;
  selectedArticles: number;
  selectedSum: number;
  onNext: () => void;
}) {
  return (
    <>
      <p className="mb-3 text-sm text-inkSoft">
        Kies per site hoeveel <span className="font-medium text-ink">artikelen</span> je wilt. Elk artikel = één plaatsing met
        een eigen prijs; binnen een artikel mag je tot &ldquo;max. links&rdquo; links verwerken.
      </p>
      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-semibold text-inkSoft">
              <th className="px-4 py-3">Aantal artikelen</th>
              <th className="px-4 py-3">Site</th>
              <th className="px-4 py-3">Niche</th>
              <th className="px-4 py-3">Max. links</th>
              <th className="px-4 py-3">DR</th>
              <th className="px-4 py-3">Prijs p/artikel</th>
              <th className="px-4 py-3 text-right">Subtotaal</th>
            </tr>
          </thead>
          <tbody>
            {SITES.map((s) => {
              const n = qty[s.id] ?? 0;
              return (
                <tr key={s.id} className={`border-t border-line text-sm ${n > 0 ? "bg-emerald-50/40" : ""}`}>
                  <td className="px-4 py-3">
                    <div className={`inline-flex items-center overflow-hidden rounded-lg border ${n > 0 ? "border-[var(--btn-pay-bg)]" : "border-line"}`}>
                      <button type="button" onClick={() => setQ(s.id, n - 1)} className="flex h-8 w-8 items-center justify-center text-inkSoft hover:bg-gray-50">
                        <Minus size={14} />
                      </button>
                      <span className={`w-8 text-center text-sm font-bold tabular-nums ${n > 0 ? "text-[var(--btn-pay-bg)]" : "text-inkSoft/50"}`}>{n}</span>
                      <button type="button" onClick={() => setQ(s.id, n + 1)} className="flex h-8 w-8 items-center justify-center text-inkSoft hover:bg-gray-50">
                        <Plus size={14} />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold text-white" style={{ background: s.color }}>
                        {s.domain[0].toUpperCase()}
                      </span>
                      <span className="font-semibold text-ink">{s.domain}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-[#eff3f0] px-2.5 py-0.5 text-xs font-medium text-[#5b7266]">{s.niche}</span>
                  </td>
                  <td className="px-4 py-3 text-xs font-medium text-inkSoft">{s.maxLinks} {s.maxLinks === 1 ? "link" : "links"}</td>
                  <td className="px-4 py-3 tabular-nums">{s.dr}</td>
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
        <button
          type="button"
          disabled={selectedArticles === 0}
          onClick={onNext}
          className="btn-pay rounded-full px-5 py-2.5 text-sm font-semibold transition disabled:opacity-40"
        >
          {selectedArticles} artikelen invullen &rarr;
        </button>
      </div>
    </>
  );
}

function FillStep({
  articles,
  projects,
  siteById,
  inputCls,
  selCls,
  onUpdate,
  onRemove,
  onSetAllProject,
  onSetAllType,
  onAddProject,
  sum,
  onBack,
  onNext,
}: {
  articles: Article[];
  projects: Project[];
  siteById: (id: string) => Site;
  inputCls: string;
  selCls: string;
  onUpdate: (id: string, patch: Partial<Article>) => void;
  onRemove: (id: string) => void;
  onSetAllProject: (projectId: string) => void;
  onSetAllType: (type: ArticleType) => void;
  onAddProject: () => void;
  sum: number;
  onBack: () => void;
  onNext: () => void;
}) {
  const projectCount = new Set(articles.map((a) => a.projectId)).size;
  return (
    <>
      <p className="mb-3 text-sm text-inkSoft">
        Kies per artikel het project (= jouw klant) en vul de link(s) in. Een site met 2 links kan een tweede link in hetzelfde
        artikel krijgen.
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
        <span className="font-semibold">⚡ Snel invullen:</span>
        <span>alles op</span>
        <select onChange={(e) => e.target.value && onSetAllProject(e.target.value)} defaultValue="" className="rounded-md border border-emerald-300 bg-white px-2 py-1 text-xs font-semibold text-emerald-900">
          <option value="" disabled>project…</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <span>en</span>
        <select onChange={(e) => e.target.value && onSetAllType(e.target.value as ArticleType)} defaultValue="" className="rounded-md border border-emerald-300 bg-white px-2 py-1 text-xs font-semibold text-emerald-900">
          <option value="" disabled>artikel…</option>
          <option value="write">Wij schrijven</option>
          <option value="self">Zelf aanleveren</option>
          <option value="later">Later aanleveren</option>
        </select>
      </div>

      <div className="space-y-2">
        {articles.map((a) => {
          const site = siteById(a.siteId);
          return (
            <div key={a.id} className="rounded-xl border border-line bg-surface p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold text-white" style={{ background: site.color }}>
                  {site.domain[0].toUpperCase()}
                </span>
                <span className="font-semibold text-ink">{site.domain}</span>
                <span className="text-xs text-inkSoft">· max {site.maxLinks} {site.maxLinks === 1 ? "link" : "links"} · {euro(site.price)}</span>
                <select value={a.projectId} onChange={(e) => onUpdate(a.id, { projectId: e.target.value })} className={`${selCls} ml-auto`}>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <select value={a.type} onChange={(e) => onUpdate(a.id, { type: e.target.value as ArticleType })} className={selCls}>
                  <option value="write">Wij schrijven</option>
                  <option value="self">Zelf aanleveren</option>
                  <option value="later">Later aanleveren</option>
                </select>
                <button type="button" onClick={() => onRemove(a.id)} className="text-inkSoft hover:text-red-600" aria-label="Verwijderen">
                  <Trash2 size={16} />
                </button>
              </div>

              {a.type !== "later" && (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <input className={inputCls} placeholder="Ankertekst" value={a.anchor} onChange={(e) => onUpdate(a.id, { anchor: e.target.value })} />
                  <input className={inputCls} placeholder="Doel-URL (https://…)" value={a.url} onChange={(e) => onUpdate(a.id, { url: e.target.value })} />
                  {site.maxLinks > 1 && !a.secondLink && (
                    <button type="button" onClick={() => onUpdate(a.id, { secondLink: true })} className="justify-self-start text-xs font-semibold text-brand hover:underline">
                      + Tweede link in dit artikel
                    </button>
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
        <button type="button" onClick={onAddProject} className="text-sm font-semibold text-brand hover:underline">
          + Nieuw project aanmaken
        </button>
      </div>

      <div className="mt-4 flex flex-col items-stretch gap-3 rounded-xl border border-[#e3d9c2] bg-[#f0ebe0] px-5 py-4 text-[#3f3a2f] sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm">
          <span className="font-extrabold">{articles.length} artikelen</span> · {projectCount} {projectCount === 1 ? "project" : "projecten"} · samen {euro(sum)} · op rekening
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onBack} className="rounded-full border border-[#d8ccb0] px-4 py-2.5 text-sm font-semibold text-[#6b6450]">&larr; Terug</button>
          <button type="button" onClick={onNext} className="btn-pay rounded-full px-5 py-2.5 text-sm font-semibold transition">Controleren &amp; bestellen &rarr;</button>
        </div>
      </div>
    </>
  );
}

function ReviewStep({
  articles,
  usedProjectIds,
  projectById,
  siteById,
  sum,
  onBack,
  onPlace,
}: {
  articles: Article[];
  usedProjectIds: string[];
  projectById: (id: string) => Project | undefined;
  siteById: (id: string) => Site;
  sum: number;
  onBack: () => void;
  onPlace: () => void;
}) {
  return (
    <>
      <p className="mb-3 text-sm text-inkSoft">
        {articles.length} artikelen, gegroepeerd per project. Onder water: 1 order per project, samen op één verzamelfactuur.
      </p>
      <div className="space-y-3">
        {usedProjectIds.map((pid) => {
          const project = projectById(pid);
          const group = articles.filter((a) => a.projectId === pid);
          const groupSum = group.reduce((n, a) => n + siteById(a.siteId).price, 0);
          return (
            <div key={pid} className="overflow-hidden rounded-xl border border-line bg-surface">
              <div className="flex items-center gap-2 border-b border-line bg-gray-50 px-4 py-3 text-sm font-bold text-ink">
                <span className="h-3 w-3 rounded-sm" style={{ background: project?.color ?? "#999" }} />
                {project?.name ?? "Project"}
                <span className="ml-auto text-xs font-semibold text-inkSoft">{group.length} artikelen · {euro(groupSum)}</span>
              </div>
              {group.map((a) => {
                const site = siteById(a.siteId);
                return (
                  <div key={a.id} className="flex items-center gap-3 border-b border-line px-4 py-3 text-sm last:border-b-0">
                    <span className="flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold text-white" style={{ background: site.color }}>
                      {site.domain[0].toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold text-ink">{site.domain}</div>
                      <div className="truncate text-xs text-inkSoft">
                        {a.type === "later" ? "nog in te vullen" : `${a.anchor || "ankertekst"} → ${a.url || "doel-URL"}`}
                        {a.secondLink && a.anchor2 ? ` · + ${a.anchor2}` : ""}
                      </div>
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

      <div className="mt-4 rounded-xl border border-[#ecdfbc] bg-[#fbf7ec] px-4 py-3 text-sm text-[#8a5a12]">
        🧾 Komt op je <span className="font-semibold">verzamelfactuur</span> — je hoeft nu niets te betalen.
      </div>

      <div className="mt-3 flex flex-col items-stretch gap-3 rounded-xl border border-line bg-surface px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-inkSoft">
          {articles.length} artikelen · {usedProjectIds.length} projecten · <span className="text-lg font-extrabold text-ink">{euro(sum)}</span> <span className="text-xs">excl. btw</span>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onBack} className="rounded-full border border-line px-4 py-2.5 text-sm font-semibold text-inkSoft">&larr; Terug</button>
          <button type="button" onClick={onPlace} className="btn-pay rounded-full px-5 py-2.5 text-sm font-semibold transition">Bestelling plaatsen &rarr;</button>
        </div>
      </div>
    </>
  );
}

function DoneStep({ articles, projectCount, sum, onRestart }: { articles: Article[]; projectCount: number; sum: number; onRestart: () => void }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-6 py-10 text-center">
      <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
        <Check size={32} strokeWidth={2.5} />
      </span>
      <h2 className="font-serif text-2xl text-ink">Bestelling klaargezet</h2>
      <p className="mt-1.5 text-inkSoft">
        {articles.length} artikelen voor {projectCount} {projectCount === 1 ? "project" : "projecten"} · {euro(sum)}
      </p>
      <p className="mx-auto mt-3 max-w-md rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
        Dit is een preview — er is geen echte bestelling geplaatst en er is niets gefactureerd.
      </p>
      <button type="button" onClick={onRestart} className="btn-pay mt-6 rounded-full px-5 py-2.5 text-sm font-semibold transition">
        Opnieuw proberen
      </button>
    </div>
  );
}
