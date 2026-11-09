"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Monitor,
  Plus,
  Redo2,
  Search,
  Smartphone,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import type { BlockDef, FieldDef, FieldValue, Resolved, SeoValue } from "@/lib/cms/types";
import { emptyOf, seoScore } from "@/lib/cms/resolve";
import { discardDraftAction, publishAction, saveDraftAction, setStatusAction } from "./actions";

// De editor van Admin → Publieke site. Links het live voorbeeld van de pagina
// (een iframe met ?cms=preview, dat het concept toont), rechts de velden van
// het gekozen blok. Elke wijziging wordt na een korte pauze als concept
// opgeslagen; "Bijwerken" zet het concept live.

type Full = Resolved<Record<string, BlockDef>>;
export type EditorDef = {
  slug: string;
  title: string;
  path: string;
  isPage: boolean;
  canUnpublish: boolean;
  blocks: Record<string, { label: string; fields: FieldDef[] }>;
};
type Props = {
  def: EditorDef;
  initial: { full: Full; status: "published" | "draft"; hasDraft: boolean; updatedAt: string | null };
  backHref: string;
  backLabel: string;
};

const time = (iso: string) => new Date(iso).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam" });
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

const INPUT =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-[13.5px] text-ink outline-none focus:border-[var(--btn-pay-bg)] focus:ring-2 focus:ring-[var(--pay-soft)]";
const LABEL = "mb-1 block text-xs font-semibold text-gray-700";
const BTN = "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13.5px] font-semibold disabled:opacity-50";
const ICON_BTN = "grid h-8 w-8 place-items-center rounded-md text-gray-600 hover:bg-gray-100 disabled:opacity-40";

export default function SiteEditor({ def, initial, backHref, backLabel }: Props) {
  const [full, setFull] = useState<Full>(initial.full);
  const [status, setStatus] = useState(initial.status);
  const [hasDraft, setHasDraft] = useState(initial.hasDraft);
  const [savedAt, setSavedAt] = useState<string | null>(initial.updatedAt);
  const [saveState, setSaveState] = useState<"idle" | "dirty" | "saving" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "publish" | "discard" | "status">(null);
  const [tab, setTab] = useState<"page" | "block">(def.isPage ? "page" : "block");
  const [selected, setSelected] = useState<string | null>(def.isPage ? null : Object.keys(def.blocks)[0] ?? null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [previewKey, setPreviewKey] = useState(0);

  // Ongedaan maken / opnieuw: snapshots van de volledige inhoud.
  const history = useRef<{ past: Full[]; future: Full[] }>({ past: [], future: [] });
  const iframe = useRef<HTMLIFrameElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(full);
  latest.current = full;

  const blockIds = useMemo(() => Object.keys(def.blocks), [def.blocks]);
  const labels = useMemo(() => Object.fromEntries(blockIds.map((id) => [id, def.blocks[id].label])), [blockIds, def.blocks]);

  // --- opslaan (concept) ------------------------------------------------
  const persist = useCallback(async () => {
    setSaveState("saving");
    const r = await saveDraftAction(def.slug, latest.current);
    if (r.ok) {
      setSavedAt(r.savedAt);
      setHasDraft(true);
      setSaveState("idle");
      setError(null);
      if (def.isPage) setPreviewKey((k) => k + 1);
    } else {
      setSaveState("error");
      setError(r.error);
    }
  }, [def.slug, def.isPage]);

  const update = useCallback(
    (mutate: (draft: Full) => void) => {
      setFull((prev) => {
        history.current.past = [...history.current.past.slice(-49), prev];
        history.current.future = [];
        const next = clone(prev);
        mutate(next);
        return next;
      });
      setSaveState("dirty");
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(persist, 900);
    },
    [persist]
  );

  const undo = () => {
    const prev = history.current.past.pop();
    if (!prev) return;
    history.current.future.push(full);
    setFull(prev);
    setSaveState("dirty");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(persist, 900);
  };
  const redo = () => {
    const next = history.current.future.pop();
    if (!next) return;
    history.current.past.push(full);
    setFull(next);
    setSaveState("dirty");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(persist, 900);
  };

  // Niet weg kunnen klikken met onopgeslagen tekst.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (saveState === "dirty" || saveState === "saving") e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveState]);

  // --- voorbeeld (iframe) -------------------------------------------------
  const send = useCallback((msg: Record<string, unknown>) => {
    iframe.current?.contentWindow?.postMessage(msg, window.location.origin);
  }, []);
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || !e.data || typeof e.data !== "object") return;
      if (e.data.type === "cms:ready") {
        send({ type: "cms:labels", labels });
        if (selected) send({ type: "cms:highlight", block: selected });
      }
      if (e.data.type === "cms:select" && typeof e.data.block === "string" && def.blocks[e.data.block]) {
        setSelected(e.data.block);
        setTab("block");
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [labels, selected, send, def.blocks]);
  useEffect(() => {
    send({ type: "cms:highlight", block: selected });
  }, [selected, send]);

  // --- acties -------------------------------------------------------------
  const doPublish = async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setBusy("publish");
    const r = await publishAction(def.slug, latest.current);
    setBusy(null);
    if (r.ok) {
      setSavedAt(r.savedAt);
      setHasDraft(false);
      setSaveState("idle");
      setError(null);
    } else setError(r.error);
  };
  const doDiscard = async () => {
    if (!confirm("Alle niet-gepubliceerde wijzigingen weggooien en terug naar wat live staat?")) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setBusy("discard");
    const r = await discardDraftAction(def.slug);
    setBusy(null);
    if ("ok" in r && r.ok === false) return setError(r.error);
    const s = r as Exclude<typeof r, { ok: false }>;
    history.current = { past: [], future: [] };
    setFull(s.full);
    setHasDraft(false);
    setSaveState("idle");
    setPreviewKey((k) => k + 1);
  };
  const toggleStatus = async () => {
    const next = status === "published" ? "draft" : "published";
    if (next === "draft" && !confirm("Pagina offline halen? Bezoekers krijgen dan een 404 op dit adres.")) return;
    setBusy("status");
    const r = await setStatusAction(def.slug, next);
    setBusy(null);
    if (r.ok) setStatus(next);
    else setError(r.error);
  };

  // --- blokken verplaatsen / verbergen -------------------------------------
  const move = (id: string, dir: -1 | 1) =>
    update((d) => {
      const i = d.order.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= d.order.length) return;
      [d.order[i], d.order[j]] = [d.order[j], d.order[i]];
    });
  const toggleHidden = (id: string) =>
    update((d) => {
      d.hidden = d.hidden.includes(id) ? d.hidden.filter((x) => x !== id) : [...d.hidden, id];
    });

  const saveLabel =
    saveState === "saving"
      ? "Opslaan…"
      : saveState === "dirty"
        ? "Niet-opgeslagen wijzigingen"
        : saveState === "error"
          ? "Opslaan mislukt"
          : savedAt
            ? `${hasDraft ? "Concept" : "Live"} · opgeslagen om ${time(savedAt)}`
            : "Standaardtekst";

  const selectedDef = selected ? def.blocks[selected] : null;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-white text-ink">
      {/* Bovenbalk */}
      <div className="flex h-[60px] shrink-0 items-center gap-2 border-b border-line px-3 sm:px-4">
        <Link href={backHref} className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 text-[13.5px] font-semibold text-gray-700 hover:bg-gray-200">
          <ArrowLeft size={15} /> {backLabel}
        </Link>
        <button type="button" className={ICON_BTN} onClick={undo} title="Ongedaan maken" disabled={history.current.past.length === 0}>
          <Undo2 size={17} />
        </button>
        <button type="button" className={ICON_BTN} onClick={redo} title="Opnieuw" disabled={history.current.future.length === 0}>
          <Redo2 size={17} />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <div className="truncate text-sm font-semibold">{def.title}</div>
          <div className={`truncate text-xs ${saveState === "error" ? "text-red-700" : "text-inkSoft"}`}>
            {def.path && <>publito.nl{def.path === "/" ? "" : def.path} · </>}
            {saveLabel}
          </div>
        </div>
        {def.isPage && (
          <>
            <button type="button" className={`${ICON_BTN} ${device === "desktop" ? "bg-gray-100" : ""}`} onClick={() => setDevice("desktop")} title="Desktop">
              <Monitor size={17} />
            </button>
            <button type="button" className={`${ICON_BTN} ${device === "mobile" ? "bg-gray-100" : ""}`} onClick={() => setDevice("mobile")} title="Mobiel">
              <Smartphone size={17} />
            </button>
          </>
        )}
        {hasDraft && (
          <button type="button" onClick={doDiscard} disabled={busy !== null} className={`${BTN} text-gray-700 hover:bg-gray-100`}>
            {busy === "discard" ? "Bezig…" : "Concept weggooien"}
          </button>
        )}
        {def.isPage && (
          <a href={`${def.path}?cms=preview`} target="_blank" rel="noreferrer" className={`${BTN} border border-line bg-white text-ink hover:bg-gray-50`}>
            <Eye size={15} /> Voorbeeld
          </a>
        )}
        <button
          type="button"
          onClick={doPublish}
          disabled={busy !== null || saveState === "saving"}
          className={`${BTN} bg-[var(--btn-pay-bg)] text-white hover:brightness-95`}
        >
          {busy === "publish" ? "Bezig…" : def.isPage ? "Bijwerken" : "Opslaan"}
        </button>
      </div>

      {error && <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">{error}</div>}

      <div className="flex min-h-0 flex-1">
        {/* Voorbeeld */}
        {def.isPage && (
          <div className="flex min-w-0 flex-1 justify-center overflow-hidden bg-[#eef0ef] p-4 sm:p-7">
            <iframe
              key={previewKey}
              ref={iframe}
              title="Voorbeeld"
              src={`${def.path}?cms=preview`}
              className={`h-full rounded-lg border border-line bg-white shadow-sm transition-[width] ${device === "mobile" ? "w-[390px]" : "w-full"}`}
            />
          </div>
        )}

        {/* Paneel */}
        <aside className={`flex min-h-0 flex-col border-l border-line bg-white ${def.isPage ? "w-[360px] shrink-0" : "w-full max-w-3xl mx-auto border-l-0"}`}>
          {def.isPage && (
            <div className="flex shrink-0 border-b border-line">
              {(["page", "block"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`flex-1 py-3 text-[13.5px] font-semibold ${tab === t ? "text-ink shadow-[inset_0_-2px_0_var(--btn-pay-bg)]" : "text-inkSoft"}`}
                >
                  {t === "page" ? "Pagina" : "Blok"}
                </button>
              ))}
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === "page" && def.isPage ? (
              <>
                <Panel title={`Blokken (${full.order.length})`}>
                  <ul className="grid gap-1">
                    {full.order.map((id, i) => {
                      const hidden = full.hidden.includes(id);
                      return (
                        <li key={id} className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 ${selected === id ? "border-[var(--btn-pay-bg)] bg-[var(--pay-soft)]" : "border-line"}`}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelected(id);
                              setTab("block");
                            }}
                            className={`min-w-0 flex-1 truncate text-left text-[13.5px] font-medium ${hidden ? "text-gray-400 line-through" : "text-ink"}`}
                          >
                            {def.blocks[id]?.label ?? id}
                          </button>
                          <button type="button" className={ICON_BTN} title="Omhoog" disabled={i === 0} onClick={() => move(id, -1)}>
                            <ChevronUp size={15} />
                          </button>
                          <button type="button" className={ICON_BTN} title="Omlaag" disabled={i === full.order.length - 1} onClick={() => move(id, 1)}>
                            <ChevronDown size={15} />
                          </button>
                          <button type="button" className={ICON_BTN} title={hidden ? "Tonen" : "Verbergen"} onClick={() => toggleHidden(id)}>
                            {hidden ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </Panel>
                <Panel title="SEO" right={<SeoDot seo={full.seo} />}>
                  <SeoFields seo={full.seo} path={def.path} onChange={(k, v) => update((d) => void (d.seo[k] = v))} />
                </Panel>
                {def.canUnpublish && (
                  <Panel title="Status">
                    <div className="flex items-center justify-between text-[13.5px]">
                      <span>{status === "published" ? "Gepubliceerd" : "Concept (niet zichtbaar)"}</span>
                      <button type="button" onClick={toggleStatus} disabled={busy !== null} className={`font-semibold ${status === "published" ? "text-red-700" : "text-[var(--btn-pay-bg)]"}`}>
                        {status === "published" ? "Offline halen" : "Publiceren"}
                      </button>
                    </div>
                  </Panel>
                )}
              </>
            ) : selected && selectedDef ? (
              <>
                {!def.isPage && blockIds.length > 1 && (
                  <div className="flex gap-1 border-b border-line px-4 py-3">
                    {blockIds.map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setSelected(id)}
                        className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ${selected === id ? "bg-[var(--pay-soft)] text-[var(--btn-pay-bg)]" : "text-inkSoft hover:bg-gray-100"}`}
                      >
                        {def.blocks[id].label}
                      </button>
                    ))}
                  </div>
                )}
                <Panel title={selectedDef.label}>
                  {selectedDef.fields.length === 0 ? (
                    <p className="text-[13px] text-inkSoft">Dit blok heeft geen eigen tekst. De inhoud komt uit Site-instellingen.</p>
                  ) : (
                    selectedDef.fields.map((f) => (
                      <Field
                        key={f.key}
                        field={f}
                        value={full.blocks[selected][f.key]}
                        onChange={(v) => update((d) => void (d.blocks[selected][f.key] = v))}
                      />
                    ))
                  )}
                </Panel>
                {def.isPage && (
                  <p className="px-4 py-3 text-[11.5px] leading-relaxed text-inkSoft">
                    Tip: <code>{"{sites}"}</code>, <code>{"{plaatsingen}"}</code>, <code>{"{prijsBlog}"}</code>, <code>{"{prijsHomepage}"}</code>,{" "}
                    <code>{"{email}"}</code>, <code>{"{landen}"}</code> en <code>{"{uren}"}</code> worden automatisch ingevuld vanuit Site-instellingen.
                  </p>
                )}
              </>
            ) : (
              <div className="p-6 text-center text-[13.5px] text-inkSoft">Klik in het voorbeeld op een blok om het te bewerken.</div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- onderdelen

function Panel({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border-b border-line px-4 py-4">
      <h4 className="mb-3 flex items-center justify-between text-[13.5px] font-semibold">
        {title}
        {right}
      </h4>
      {children}
    </section>
  );
}

function SeoDot({ seo }: { seo: SeoValue }) {
  const s = seoScore(seo);
  const c = { good: ["bg-green-500", "Goed"], ok: ["bg-amber-400", "Kan beter"], bad: ["bg-red-500", "Ontbreekt"] }[s];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600">
      <span className={`h-2.5 w-2.5 rounded-full ${c[0]}`} /> {c[1]}
    </span>
  );
}

function Meter({ n, min, max }: { n: number; min: number; max: number }) {
  const ok = n >= min && n <= max;
  const pct = Math.min(100, (n / max) * 100);
  return (
    <div className="mt-1">
      <div className="h-1 overflow-hidden rounded bg-gray-200">
        <div className={`h-full ${ok ? "bg-green-500" : n > max ? "bg-red-500" : "bg-amber-400"}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-inkSoft">
        <span>{ok ? "Lengte goed" : n > max ? "Te lang" : n === 0 ? "Leeg" : "Aan de korte kant"}</span>
        <span>
          {n} / {max}
        </span>
      </div>
    </div>
  );
}

function SeoFields({ seo, path, onChange }: { seo: SeoValue; path: string; onChange: (k: keyof SeoValue, v: string) => void }) {
  return (
    <div className="grid gap-3">
      <div>
        <label className={LABEL}>Focuszoekwoord</label>
        <input className={INPUT} value={seo.keyword} onChange={(e) => onChange("keyword", e.target.value)} />
      </div>
      <div>
        <label className={LABEL}>SEO-titel</label>
        <input className={INPUT} value={seo.title} onChange={(e) => onChange("title", e.target.value)} />
        <Meter n={seo.title.length} min={30} max={60} />
      </div>
      <div>
        <label className={LABEL}>Meta-omschrijving</label>
        <textarea className={`${INPUT} min-h-[72px]`} value={seo.description} onChange={(e) => onChange("description", e.target.value)} />
        <Meter n={seo.description.length} min={110} max={160} />
      </div>
      <div className="rounded-lg border border-line p-3">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gray-100">
            <Search size={11} />
          </span>
          publito.nl{path === "/" ? "" : path.replace(/\//g, " › ")}
        </div>
        <div className="mt-1.5 text-[16px] leading-snug text-[#1a0dab]">{seo.title || "SEO-titel"}</div>
        <div className="mt-1 text-[12.5px] leading-relaxed text-[#4d5156]">{seo.description || "Meta-omschrijving"}</div>
      </div>
    </div>
  );
}

function Field({ field, value, onChange }: { field: FieldDef; value: FieldValue; onChange: (v: FieldValue) => void }) {
  const help = field.help ? <p className="mt-1 text-[11.5px] text-inkSoft">{field.help}</p> : null;
  switch (field.type) {
    case "text":
      return (
        <div className="mb-3">
          <label className={LABEL}>{field.label}</label>
          <input className={INPUT} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} />
          {help}
        </div>
      );
    case "textarea":
      return (
        <div className="mb-3">
          <label className={LABEL}>{field.label}</label>
          <textarea className={`${INPUT} min-h-[84px]`} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} />
          {help}
        </div>
      );
    case "bool":
      return (
        <label className="mb-3 flex items-center gap-2 text-[13.5px]">
          <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[var(--btn-pay-bg)]" />
          {field.label}
          {field.help && <span className="text-xs text-inkSoft">· {field.help}</span>}
        </label>
      );
    case "link": {
      const v = (value && typeof value === "object" && !Array.isArray(value) ? value : { label: "", href: "" }) as { label: string; href: string };
      return (
        <div className="mb-3">
          <label className={LABEL}>{field.label}</label>
          <div className="grid grid-cols-[1.3fr_1fr] gap-2">
            <input className={INPUT} placeholder="Tekst op de knop" value={v.label} onChange={(e) => onChange({ ...v, label: e.target.value })} />
            <input className={INPUT} placeholder="/pad of https://" value={v.href} onChange={(e) => onChange({ ...v, href: e.target.value })} />
          </div>
          <p className="mt-1 text-[11.5px] text-inkSoft">Leeg laten verbergt de knop.</p>
        </div>
      );
    }
    case "tags":
      return <TagsField field={field} value={Array.isArray(value) ? (value as string[]) : []} onChange={onChange} />;
    case "items":
      return <ItemsField field={field} value={Array.isArray(value) ? (value as Record<string, FieldValue>[]) : []} onChange={onChange} />;
  }
}

function TagsField({ field, value, onChange }: { field: FieldDef; value: string[]; onChange: (v: FieldValue) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const t = draft.trim();
    if (!t) return;
    onChange([...value, t]);
    setDraft("");
  };
  return (
    <div className="mb-3">
      <label className={LABEL}>{field.label}</label>
      <div className="rounded-lg border border-gray-300 p-2">
        <div className="flex flex-wrap gap-1.5">
          {value.map((t, i) => (
            <span key={`${t}-${i}`} className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-[12.5px]">
              {t}
              <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="text-gray-500 hover:text-red-700" title="Verwijderen">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            className={`${INPUT} !py-1.5`}
            placeholder="Nieuw item, Enter om toe te voegen"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
          />
          <button type="button" onClick={add} className={`${BTN} border border-line bg-white !px-2.5`} title="Toevoegen">
            <Plus size={15} />
          </button>
        </div>
      </div>
      {field.help && <p className="mt-1 text-[11.5px] text-inkSoft">{field.help}</p>}
    </div>
  );
}

function ItemsField({ field, value, onChange }: { field: FieldDef; value: Record<string, FieldValue>[]; onChange: (v: FieldValue) => void }) {
  const sub = field.itemFields ?? [];
  const name = field.itemLabel ?? "Item";
  const set = (i: number, k: string, v: FieldValue) => onChange(value.map((it, j) => (j === i ? { ...it, [k]: v } : it)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const add = () => onChange([...value, Object.fromEntries(sub.map((f) => [f.key, emptyOf(f)]))]);
  return (
    <div className="mb-3">
      <label className={LABEL}>{field.label}</label>
      <div className="grid gap-2">
        {value.map((it, i) => (
          <details key={i} className="group rounded-lg border border-line bg-gray-50/50" open={value.length <= 3}>
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-[13px] font-semibold [&::-webkit-details-marker]:hidden">
              <span className="text-inkSoft">{i + 1}.</span>
              <span className="min-w-0 flex-1 truncate">{String(it[sub[0]?.key ?? ""] || `${name} ${i + 1}`)}</span>
              <button type="button" className={ICON_BTN} title="Omhoog" disabled={i === 0} onClick={(e) => (e.preventDefault(), move(i, -1))}>
                <ChevronUp size={14} />
              </button>
              <button type="button" className={ICON_BTN} title="Omlaag" disabled={i === value.length - 1} onClick={(e) => (e.preventDefault(), move(i, 1))}>
                <ChevronDown size={14} />
              </button>
              <button
                type="button"
                className={`${ICON_BTN} hover:text-red-700`}
                title="Verwijderen"
                onClick={(e) => {
                  e.preventDefault();
                  if (confirm(`${name} ${i + 1} verwijderen?`)) onChange(value.filter((_, j) => j !== i));
                }}
              >
                <Trash2 size={14} />
              </button>
            </summary>
            <div className="border-t border-line bg-white px-3 pb-1 pt-3">
              {sub.map((f) => (
                <Field key={f.key} field={f} value={it[f.key]} onChange={(v) => set(i, f.key, v)} />
              ))}
            </div>
          </details>
        ))}
      </div>
      <button type="button" onClick={add} className={`${BTN} mt-2 border border-line bg-white text-ink hover:bg-gray-50`}>
        <Plus size={15} /> {name} toevoegen
      </button>
      {field.help && <p className="mt-1 text-[11.5px] text-inkSoft">{field.help}</p>}
    </div>
  );
}
