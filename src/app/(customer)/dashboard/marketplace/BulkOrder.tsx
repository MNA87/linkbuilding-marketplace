"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarDays, Check, ChevronDown, Clock, ExternalLink, FileText, Folder, GripVertical, Info, Link2, Lock, Minus, Pencil, Plus, SlidersHorizontal, Trash2, X } from "lucide-react";
import CountryFlag from "@/components/CountryFlag";
import RichTextEditor from "@/components/RichTextEditor";
import PhotoPicker from "@/components/PhotoPicker";
import DatePicker from "@/components/DatePicker";
import { durationKindLabel } from "@/lib/placementPeriod";
import { htmlHasText, looksLikeSite } from "@/lib/bulkArticle";
import {
  DEFAULT_COLUMNS,
  moveColumn,
  parseColumns,
  serializeColumns,
  type ColumnKey,
  type ColumnPrefs,
} from "@/lib/marketplace";
import { addBulkItemAction, placeBulkCartAction, saveBulkDraftAction, createBulkProjectAction } from "./actions";
import { removeCartItemAction } from "@/app/(customer)/dashboard/cart/actions";
import { fetchGoogleDocAction } from "@/app/(customer)/marketplace/[websiteProductId]/actions";

export type BulkSite = {
  id: string; // websiteProduct id
  kind: "blog" | "homepage"; // BLOG_POST of HOMEPAGE_LINK
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
// The saved-as-you-go content of one row (OrderItem.draftContent). Everything
// optional — a draft may be partial or not-yet-chosen.
export type BulkDraft = Partial<Omit<Article, "id" | "siteId">> | null;
// An item already in the cart (the bulk order in progress), with whatever was
// filled in so far — so you can leave and pick the order back up on any device.
export type BulkCartItem = { orderItemId: string; websiteProductId: string; draft?: BulkDraft };

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
  // "Zelf aanleveren": either a Google Doc link or own article (title + body +
  // optional image), just like the regular order form.
  selfText: boolean;
  docUrl: string;
  title: string;
  body: string;
  imageKey: string;
  publishOn: string; // "" = zo snel mogelijk
};

const TYPE_LABEL: Record<ArticleType, string> = {
  write: "Laat ons schrijven",
  self: "Zelf aanleveren",
  later: "Later aanleveren",
};

// The same column set as the regular marketplace (shared from lib/marketplace),
// so the two never drift apart: each can be switched on/off and dragged into
// another order, remembered in localStorage.
const COL_LABEL: Record<ColumnKey, string> = {
  niche: "Niche",
  land: "Land",
  taal: "Taal",
  dr: "DR",
  da: "DA",
  verkeer: "Verkeer",
  tfcf: "TF / CF",
  rd: "Verw. dom.",
  maxlinks: "Max. links",
  gesponsord: "Gesponsord",
  duur: "Looptijd",
  voorbeeld: "Voorbeeld",
};
const COL_RIGHT = new Set<ColumnKey>(["dr", "da", "verkeer", "tfcf", "rd", "maxlinks"]);
const COLS_KEY = "nugevonden-bulk-columns-v2";

const euro = (n: number) => `€ ${n.toLocaleString("nl-NL")}`;
const nl = (n: number | null) => (n === null ? "–" : n.toLocaleString("nl-NL"));
const dayLabel = (d: string) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" }) : "zo snel mogelijk");

// A "Zelf aanleveren" article counts as delivered only when there's real text
// (an empty editor still holds "<p></p>", which should NOT count) or a Google
// Doc link — so you can't "opslaan" an empty article.
function hasSelfContent(a: Article): boolean {
  return a.docUrl.trim().length > 0 || htmlHasText(a.body);
}

// Whether a row has real content worth warning about before it's removed — a
// link or an article. Only these count: type / project / datum (bv. via "Snel
// invullen") zijn instellingen, geen inhoud, dus zolang de link/het artikel
// leeg is verwijder je de regel direct, zonder dubbelcheck.
function rowHasContent(a: Article): boolean {
  return (
    a.anchor.trim().length > 0 ||
    a.url.trim().length > 0 ||
    a.anchor2.trim().length > 0 ||
    a.url2.trim().length > 0 ||
    a.title.trim().length > 0 ||
    hasSelfContent(a)
  );
}
const REMOVE_WARNING = "Deze regel heb je al (deels) ingevuld. Verwijderen? De ingevulde inhoud gaat verloren.";

// Per-row status on "Invullen": todo (something must still be done), done
// (ready), or later (deliberately deferred — fine as is). Drives the subtle
// yellow edge and the "Alleen nog te doen"-filter.
// "Laat ons schrijven" counts as filled in only when there's an ankertekst AND
// a real doel-URL (a site, i.e. something with a dot like nu.nl) — so a row
// never reads as done on the anchor alone, the site has to be there too.
// (looksLikeSite leeft in @/lib/bulkArticle zodat de server dezelfde check doet.)
function hasWriteLink(a: Article): boolean {
  return a.anchor.trim().length > 0 && looksLikeSite(a.url);
}
function hasSecondWriteLink(a: Article): boolean {
  return a.secondLink && a.anchor2.trim().length > 0 && looksLikeSite(a.url2);
}

type RowStatus = "todo" | "done" | "later";
function rowStatus(a: Article): RowStatus {
  if (a.type === "") return "todo";
  if (a.type === "later") return "later";
  if (a.type === "write") return hasWriteLink(a) ? "done" : "todo";
  return hasSelfContent(a) ? "done" : "todo"; // self
}
// A row that still needs something gets a yellow edge; a done row (incl. "Later
// aanleveren") gets a green edge — matching the yellow/green status everywhere.
const STATUS_EDGE: Record<RowStatus, string> = {
  todo: "border-l-amber-400",
  done: "[border-left-color:var(--btn-pay-bg)]",
  later: "[border-left-color:var(--btn-pay-bg)]",
};

// Light fields with a thin border — the calmer "variant A" look.
const fieldCls = "w-full rounded-md border border-line bg-white px-2.5 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand";
const pickCls = "w-full rounded-md border border-line bg-white px-2 py-2 text-sm font-medium text-ink focus:outline-none focus:ring-2 focus:ring-brand";
// "+ Link/Artikel toevoegen" — geel zolang het nog moet; ingevuld wordt het een
// groene samenvatting met vinkje (zie de Inhoud-cel op Invullen).
const addBtnCls = "inline-flex w-[195px] items-center justify-start gap-2 whitespace-nowrap rounded-lg border-[1.5px] border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800 transition hover:bg-amber-100";
// Ingevuld: exact hetzelfde formaat als "+ toevoegen", maar groen met vinkje —
// tegelijk de bewerk-knop. Vaste breedte zodat "Volgt later", "Artikel
// toegevoegd" en "Link toegevoegd" allemaal even groot zijn.
const doneBtnCls = "inline-flex w-[195px] items-center justify-start gap-2 whitespace-nowrap rounded-lg border-[1.5px] border-dashed [border-color:var(--btn-pay-bg)] bg-[#f1f9f4] px-3 py-2 text-sm font-bold text-[var(--btn-pay-bg)] transition hover:bg-[#e6f2ea]";
// Geen manier gekozen: één gele "Actie nodig"-knop (waarschuwingsdriehoekje) die
// de inhoud-popup opent, waar je eerst kiest hoe je aanlevert.
const actionBtnCls = "inline-flex w-[195px] items-center justify-start gap-2 whitespace-nowrap rounded-lg border-[1.5px] border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800 transition hover:bg-amber-100";

// A fresh, empty row for a site's cart item (id = the cart orderItemId).
function blankArticle(id: string, siteId: string): Article {
  return { id, siteId, projectId: "", type: "", anchor: "", url: "", secondLink: false, anchor2: "", url2: "", selfText: false, docUrl: "", title: "", body: "", imageKey: "", publishOn: "" };
}

// Rebuild a row from a cart item plus whatever was saved on it (draftContent),
// so an unfinished order comes back exactly as you left it — on any device.
// A project that no longer exists is dropped to "none".
function articleFromCart(ci: BulkCartItem, projectIds: Set<string>): Article {
  const base = blankArticle(ci.orderItemId, ci.websiteProductId);
  const d = ci.draft;
  if (!d) return base;
  return {
    ...base,
    projectId: d.projectId && projectIds.has(d.projectId) ? d.projectId : "",
    type: d.type === "write" || d.type === "self" || d.type === "later" ? d.type : "",
    anchor: d.anchor ?? "",
    url: d.url ?? "",
    secondLink: Boolean(d.secondLink),
    anchor2: d.anchor2 ?? "",
    url2: d.url2 ?? "",
    selfText: Boolean(d.selfText),
    docUrl: d.docUrl ?? "",
    title: d.title ?? "",
    body: d.body ?? "",
    imageKey: d.imageKey ?? "",
    publishOn: d.publishOn ?? "",
  };
}

export default function BulkOrder({ sites, projects: initialProjects, schedule, topics, topicId, writingFee, vatRate, vatNote, initialCart }: { sites: BulkSite[]; projects: BulkProject[]; schedule: { min: string; max: string }; topics: { id: string; name: string }[]; topicId: string; writingFee: number; vatRate: number; vatNote: string | null; initialCart: BulkCartItem[] }) {
  const router = useRouter();
  // "Prijzen voor": switching onderwerp re-loads the page at that topic's prices.
  // The cart keeps the selection; the draft restores the filled-in content.
  const onTopic = (id: string) => router.push(id ? `/dashboard/marketplace?prijzen=${id}` : "/dashboard/marketplace");
  // Projects can grow while you fill in a bulk order (a new client added
  // inline), so they live in state rather than staying a fixed prop.
  const [projects, setProjects] = useState<BulkProject[]>(initialProjects);
  const addProject = (p: BulkProject) =>
    setProjects((cur) => (cur.some((x) => x.id === p.id) ? cur : [...cur, p]));
  // Start on "Kiezen" for a stable server/client first render; the effect below
  // restores where you actually were across a refresh (or resumes a draft on a
  // fresh first load), so refreshing on step 1 no longer bounces you to step 2.
  const [step, setStep] = useState<"select" | "fill" | "review" | "done">("select");
  // One row per cart item (its id IS the cart orderItemId). The cart — not local
  // state — decides which items exist, so the top-bar badge can't drift. Each row
  // is rehydrated from what was saved on its item, so an unfinished order comes
  // back exactly as left, on any device.
  const [articles, setArticles] = useState<Article[]>(() => {
    const projectIds = new Set(initialProjects.map((p) => p.id));
    return initialCart.map((ci) => articleFromCart(ci, projectIds));
  });
  // Sites with an add/remove call in flight, so the +/- can't be double-clicked.
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ orderCount: number; articleCount: number } | null>(null);
  const [columns, setColumns] = useState<ColumnPrefs>(DEFAULT_COLUMNS);
  // Welke regel in de bewerk-popup staat — op parent-niveau, zodat zowel
  // Invullen als Bevestigen (het pennetje) dezelfde popup kan openen.
  const [editingId, setEditingId] = useState<string | null>(null);

  // Remember the current step across a page refresh, so going back to "Kiezen"
  // and refreshing keeps you on "Kiezen" instead of jumping to "Invullen".
  // On a fresh first load (nothing remembered) we still resume a saved draft.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("bulkStep");
      // An empty cart has nothing to fill or review, so always open on "Kiezen"
      // (even if "fill" was remembered) — coming back after deleting everything
      // shouldn't drop you on an empty Invullen.
      if (saved === "select") { setStep("select"); return; }
      if ((saved === "fill" || saved === "review") && initialCart.length > 0) { setStep(saved); return; }
    } catch { /* storage unavailable */ }
    if (initialCart.length > 0) setStep("fill");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try {
      if (step === "done") { sessionStorage.removeItem("bulkStep"); }
      else sessionStorage.setItem("bulkStep", step);
    } catch { /* storage unavailable */ }
  }, [step]);
  // Deleting the last row (so the cart is empty) drops you back on "Kiezen" —
  // there's nothing left to fill or review.
  useEffect(() => {
    if (articles.length === 0 && (step === "fill" || step === "review")) setStep("select");
  }, [articles.length, step]);

  const markPending = (siteId: string, on: boolean) =>
    setPending((cur) => {
      const next = new Set(cur);
      if (on) next.add(siteId);
      else next.delete(siteId);
      return next;
    });

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(COLS_KEY);
      if (saved) setColumns(parseColumns(saved));
    } catch {
      // Keep the defaults.
    }
  }, []);

  // Save the half-filled rows to the server as you go (debounced) — so you can
  // leave and pick the order back up later on any device. The freshly-hydrated
  // first render is skipped (nothing changed yet), and nothing is saved once the
  // order is placed.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSave = useRef(true);
  const draftPayload = () => ({
    articles: articles.map((a) => ({
      orderItemId: a.id,
      projectId: a.projectId,
      type: a.type,
      anchor: a.anchor,
      url: a.url,
      secondLink: a.secondLink,
      anchor2: a.anchor2,
      url2: a.url2,
      selfText: a.selfText,
      docUrl: a.docUrl,
      title: a.title,
      body: a.body,
      imageKey: a.imageKey,
      publishOn: a.publishOn,
    })),
  });
  async function flushDraft() {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (articles.length === 0) return;
    try {
      await saveBulkDraftAction(draftPayload());
    } catch {
      // A lost autosave isn't worth surfacing an error for.
    }
  }
  useEffect(() => {
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    if (step === "done" || articles.length === 0) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveBulkDraftAction(draftPayload());
    }, 800);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articles, step]);

  // Also flush the moment the tab is hidden/closed, so the last edit isn't lost
  // in the debounce window when you navigate away.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden" && step !== "done") void flushDraft();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articles, step]);

  function updateColumns(next: ColumnPrefs) {
    setColumns(next);
    try {
      window.localStorage.setItem(COLS_KEY, serializeColumns(next));
    } catch {
      // ignore
    }
  }

  const siteById = (id: string) => sites.find((s) => s.id === id)!;
  const projectById = (id: string) => projects.find((p) => p.id === id);

  // How many rows (cart items) each site has — the stepper count on "Kiezen".
  const qty: Record<string, number> = {};
  for (const a of articles) qty[a.siteId] = (qty[a.siteId] ?? 0) + 1;
  const selectedArticles = articles.length;
  const editArticle = editingId ? articles.find((x) => x.id === editingId) ?? null : null;
  // Per-row price including the "Laat ons schrijven" writing fee (€25, or 0 when
  // writing is in this customer's price). The type is only known from "Invullen"
  // on, so on "Kiezen" every row is still just the placement price.
  const rowPrice = (a: Article) => { const s = siteById(a.siteId); return s.price + (a.type === "write" && s.kind === "blog" ? writingFee : 0); };
  // Hoeveel geselecteerde regels nog inhoud nodig hebben — zodat de Selecteren-knop
  // slim kan zijn ("Nog X invullen" als je al bezig was).
  const remainingToFill = articles.reduce((n, a) => n + (rowStatus(a) === "todo" ? 1 : 0), 0);

  // "+" — drop a real (empty) item in the cart so the top-bar cart badge reacts
  // right away, then add its row. Its article content is filled in afterwards.
  async function addSite(siteId: string) {
    if (pending.has(siteId)) return;
    markPending(siteId, true);
    setError(null);
    try {
      const res = await addBulkItemAction({ websiteProductId: siteId, topicId: topicId || null });
      if (res.error || !res.orderItemId) {
        setError(res.error ?? "Toevoegen mislukt.");
        return;
      }
      setArticles((list) => [...list, blankArticle(res.orderItemId!, siteId)]);
      router.refresh();
    } catch {
      setError("Toevoegen mislukt. Probeer het opnieuw.");
    } finally {
      markPending(siteId, false);
    }
  }

  // "−" — remove this site's last row and its cart item (so the badge drops).
  // A row you've already filled in asks first, so nothing is lost by a stray tap.
  async function removeSite(siteId: string) {
    if (pending.has(siteId)) return;
    let target: Article | undefined;
    for (let i = articles.length - 1; i >= 0; i--) {
      if (articles[i].siteId === siteId) { target = articles[i]; break; }
    }
    if (!target) return;
    if (rowHasContent(target) && !window.confirm(REMOVE_WARNING)) return;
    await dropRow(siteId, target.id);
  }

  // Remove one specific row (the trash button on "Invullen") and its cart item.
  async function removeArticle(id: string) {
    const a = articles.find((x) => x.id === id);
    if (!a) return;
    if (rowHasContent(a) && !window.confirm(REMOVE_WARNING)) return;
    await dropRow(a.siteId, id);
  }

  async function dropRow(siteId: string, orderItemId: string) {
    if (pending.has(siteId)) return;
    markPending(siteId, true);
    try {
      const res = await removeCartItemAction(orderItemId);
      if (res.success) {
        setArticles((list) => list.filter((a) => a.id !== orderItemId));
        router.refresh();
      } else {
        setError(res.error ?? "Verwijderen mislukt.");
      }
    } catch {
      setError("Verwijderen mislukt. Probeer het opnieuw.");
    } finally {
      markPending(siteId, false);
    }
  }

  const updateArticle = (id: string, patch: Partial<Article>) => setArticles((list) => list.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  function goToFill() {
    setError(null);
    setStep("fill");
  }
  function backToSelect() {
    setStep("select");
  }
  // Hop back to an earlier (already-done) step from the stepper.
  function jumpTo(target: string) {
    if (target === "select") backToSelect();
    else if (target === "fill" || target === "review") setStep(target);
  }
  const setAllProject = (projectId: string) => setArticles((list) => list.map((a) => ({ ...a, projectId })));
  // "Manier van aanleveren" op alle regels — behalve homepage links, die leveren
  // altijd na de bestelling aan.
  // Homepage links hebben geen schrijf-/zelf-keuze (alleen een link of later),
  // dus "Laat ons schrijven"/"Zelf aanleveren" slaan ze over. "Later aanleveren"
  // geldt wél voor homepage links — die mogen ook later aangeleverd worden.
  const setAllType = (type: ArticleType) =>
    setArticles((list) => list.map((a) => (siteById(a.siteId).kind === "homepage" && type !== "later" ? a : { ...a, type })));

  const articlesSum = articles.reduce((n, a) => n + rowPrice(a), 0);

  async function place() {
    setError(null);
    setLoading(true);
    try {
      const res = await placeBulkCartAction({
        articles: articles.map((a) => ({
          orderItemId: a.id,
          projectId: a.projectId,
          type: a.type,
          anchor: a.anchor,
          url: a.url,
          anchor2: a.secondLink ? a.anchor2 : "",
          url2: a.secondLink ? a.url2 : "",
          docUrl: a.type === "self" ? a.docUrl : "",
          title: a.type === "self" ? a.title : "",
          body: a.type === "self" ? a.body : "",
          imageKey: a.type === "self" ? a.imageKey : "",
          publishOn: a.publishOn,
        })),
      });
      if (!res.success) {
        setError(res.error ?? "Er ging iets mis.");
        setLoading(false);
        return;
      }
      setResult({ orderCount: res.orderCount ?? 1, articleCount: res.articleCount ?? articles.length });
      setStep("done");
      router.refresh();
    } catch {
      setError("Er ging iets mis. Probeer het opnieuw.");
      setLoading(false);
    }
  }

  return (
    <div className={step === "select" ? "w-full" : "max-w-7xl"}>
      {step === "select" && (
        <div className="mb-4">
          <h1 className="font-serif text-2xl text-ink">Marketplace</h1>
        </div>
      )}

      <Stepper step={step} onJump={step === "done" ? undefined : jumpTo} fillDone={articles.length - remainingToFill} fillTotal={articles.length} />

      {error && step !== "done" && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
      )}

      {step === "select" && (
        <SelectStep sites={sites} qty={qty} pending={pending} onAdd={addSite} onRemove={removeSite} columns={columns} onColumns={updateColumns} topics={topics} topicId={topicId} onTopic={onTopic} selectedArticles={selectedArticles} remainingToFill={remainingToFill} onNext={goToFill} />
      )}

      {step === "fill" && (
        <FillStep
          articles={articles}
          projects={projects}
          schedule={schedule}
          siteById={siteById}
          onUpdate={updateArticle}
          onRemove={removeArticle}
          onAddSites={backToSelect}
          onSetAllProject={setAllProject}
          onSetAllType={setAllType}
          onAddProject={addProject}
          writingFee={writingFee}
          sum={articlesSum}
          onEdit={setEditingId}
          onNext={() => setStep("review")}
        />
      )}

      {step === "review" && (
        <ReviewStep
          articles={articles}
          projectById={projectById}
          siteById={siteById}
          writingFee={writingFee}
          vatRate={vatRate}
          vatNote={vatNote}
          sum={articlesSum}
          loading={loading}
          onRemove={removeArticle}
          canPlace={articles.length > 0 && remainingToFill === 0}
          onEdit={setEditingId}
          onBack={() => setStep("fill")}
          onPlace={place}
        />
      )}

      {step === "done" && result && <DoneStep articleCount={result.articleCount} orderCount={result.orderCount} sum={articlesSum} />}

      {editArticle && (
        <EditArticleModal key={editArticle.id} a={editArticle} siteById={siteById} writingFee={writingFee} schedule={schedule} projects={projects} lockType={step === "review"} onUpdate={updateArticle} onAddProject={addProject} onClose={() => setEditingId(null)} />
      )}
    </div>
  );
}

function Stepper({ step, onJump, fillDone, fillTotal }: { step: string; onJump?: (key: string) => void; fillDone?: number; fillTotal?: number }) {
  const steps = [
    { key: "select", label: "Selecteren" },
    { key: "fill", label: "Invullen" },
    { key: "review", label: "Bevestigen" },
  ];
  const order = ["select", "fill", "review", "done"];
  const current = order.indexOf(step);
  // Op "Invullen" laten we de voortgangslijn (die naar Bevestigen) meelopen met
  // hoeveel regels al af zijn — zo is er geen tweede balk nodig onder de tabel,
  // de stap-indicator die je al had toont nu de voortgang zelf.
  const onFill = step === "fill" && typeof fillTotal === "number" && fillTotal > 0;
  const fillPct = onFill ? Math.round(((fillDone ?? 0) / fillTotal!) * 100) : 0;
  const allFilled = onFill && (fillDone ?? 0) >= fillTotal!;
  return (
    <ol className="mb-6 flex items-center">
      {steps.map((s, i) => {
        const idx = order.indexOf(s.key);
        const done = idx < current;
        const active = idx === current;
        // Done steps are clickable, so you can hop back (e.g. to "Kiezen") without
        // losing anything you already filled in.
        const clickable = done && !!onJump;
        // De lijn ná deze stap: normaal vol (groen) als de stap af is, anders grijs.
        // Uitzondering: de lijn ná "Invullen" wordt op die stap een voortgangsbalk.
        const progressConnector = active && s.key === "fill" && onFill;
        const inner = (
          <>
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${done ? "bg-[var(--btn-pay-bg)] text-white" : active ? "border-2 border-[var(--btn-pay-bg)] bg-white text-[var(--btn-pay-bg)]" : "bg-gray-200 text-inkSoft"}`}>
              {done ? <Check size={15} strokeWidth={3} /> : i + 1}
            </span>
            {/* Op mobiel alleen het label van de actieve stap tonen (de rest
                toont enkel het rondje), anders wordt de stepper te breed en valt
                "Bevestigen" buiten beeld. Vanaf sm alle labels. */}
            <span className={`text-sm font-semibold ${done || active ? "text-ink" : "text-inkSoft/70"} ${active ? "" : "hidden sm:inline"}`}>{s.label}</span>
            {active && s.key === "fill" && onFill && (
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${allFilled ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>{fillDone ?? 0}/{fillTotal}</span>
            )}
          </>
        );
        return (
          <li key={s.key} className={`flex items-center ${i < steps.length - 1 ? "flex-1" : ""}`}>
            {clickable ? (
              <button type="button" onClick={() => onJump!(s.key)} className="flex items-center gap-2 rounded-md hover:opacity-80" title={`Terug naar ${s.label}`}>{inner}</button>
            ) : (
              <span className="flex items-center gap-2">{inner}</span>
            )}
            {i < steps.length - 1 && (
              progressConnector ? (
                <>
                  {/* Mobiel: gewone lijn (het korte voortgangsbalkje oogt daar als
                      een toggle). De 1/2-badge toont de voortgang daar al. */}
                  <span className="mx-3 h-0.5 flex-1 rounded bg-line sm:hidden" />
                  <span className="mx-3 hidden h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200 sm:block" role="progressbar" aria-valuenow={fillDone ?? 0} aria-valuemin={0} aria-valuemax={fillTotal} aria-label="Ingevulde regels">
                    <span className="block h-full rounded-full bg-[var(--btn-pay-bg)] transition-all duration-300" style={{ width: `${fillPct}%` }} />
                  </span>
                </>
              ) : (
                <span className={`mx-3 h-0.5 flex-1 rounded ${done ? "bg-[var(--btn-pay-bg)]" : "bg-line"}`} />
              )
            )}
          </li>
        );
      })}
    </ol>
  );
}

function bulkCell(s: BulkSite, key: ColumnKey): ReactNode {
  switch (key) {
    case "niche":
      return <span className="rounded-full bg-[#eff3f0] px-2.5 py-0.5 text-xs font-medium text-[#5b7266]">{s.niche}</span>;
    case "land":
      return <span className="text-inkSoft">{s.country}</span>;
    case "taal":
      return <span className="text-inkSoft">{s.language}</span>;
    case "dr":
      return <span className="tabular-nums">{nl(s.dr)}</span>;
    case "da":
      return <span className="tabular-nums">{nl(s.da)}</span>;
    case "verkeer":
      return <span className="tabular-nums">{nl(s.traffic)}</span>;
    case "tfcf":
      return <span className="tabular-nums">{nl(s.trustFlow)} / {nl(s.citationFlow)}</span>;
    case "rd":
      return <span className="tabular-nums">{nl(s.referringDomains)}</span>;
    case "maxlinks":
      return <span className="text-xs font-medium text-inkSoft">{s.maxLinks}</span>;
    case "gesponsord":
      return <span className="text-inkSoft">{s.sponsored ? "Ja" : "Nee"}</span>;
    case "duur":
      return <span className="text-inkSoft">{durationKindLabel(s.periodic)}</span>;
    case "voorbeeld":
      return s.exampleUrl ? (
        <a href={s.exampleUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-brand hover:underline">Bekijk</a>
      ) : (
        <span className="text-xs text-inkSoft">Op aanvraag</span>
      );
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

function SelectStep({ sites, qty, pending, onAdd, onRemove, columns, onColumns, topics, topicId, onTopic, selectedArticles, remainingToFill, onNext }: { sites: BulkSite[]; qty: Record<string, number>; pending: Set<string>; onAdd: (id: string) => void; onRemove: (id: string) => void; columns: ColumnPrefs; onColumns: (p: ColumnPrefs) => void; topics: { id: string; name: string }[]; topicId: string; onTopic: (id: string) => void; selectedArticles: number; remainingToFill: number; onNext: () => void }) {
  const [colsOpen, setColsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dragging, setDragging] = useState<ColumnKey | null>(null);
  const [openDetails, setOpenDetails] = useState<Set<string>>(new Set());
  const toggleDetails = (id: string) =>
    setOpenDetails((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const shown = columns.order.filter((k) => columns.shown.includes(k));
  const toggleShown = (key: ColumnKey) =>
    onColumns({ order: columns.order, shown: columns.shown.includes(key) ? columns.shown.filter((k) => k !== key) : [...columns.shown, key] });
  const dropOn = (key: ColumnKey) => {
    if (dragging && dragging !== key) onColumns({ order: moveColumn(columns.order, dragging, key), shown: columns.shown });
    setDragging(null);
  };

  // The same filter set as the regular marktplaats, run client-side over the
  // sites already loaded. A site you already picked keeps its count even when a
  // filter hides it.
  const [search, setSearch] = useState("");
  const [niche, setNiche] = useState("");
  const [land, setLand] = useState("");
  const [taal, setTaal] = useState("");
  const [minDr, setMinDr] = useState("");
  const [minDa, setMinDa] = useState("");
  const [minTraffic, setMinTraffic] = useState("");
  const [minLinks, setMinLinks] = useState("");
  const [sponsored, setSponsored] = useState("");
  const [duur, setDuur] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  // Blog links of homepage links — standaard Blog links, zodat een domein dat
  // beide biedt niet dubbel in de lijst staat (je ziet één type tegelijk).
  const [linkType, setLinkType] = useState<"blog" | "homepage">("blog");
  const hasHomepage = sites.some((s) => s.kind === "homepage");
  const uniqSorted = (vals: string[]) => Array.from(new Set(vals)).filter((v) => v && v !== "—").sort((a, b) => a.localeCompare(b, "nl"));
  const q = search.trim().toLowerCase();
  const atLeast = (value: number | null, v: string) => v === "" || (value ?? -1) >= Number(v);
  // Elk filter als los predicaat, zodat we (a) de lijst filteren én (b) per
  // dropdown alleen waardes tonen die — mét de andere actieve filters — écht
  // resultaat geven ("faceted"). Zo kun je bijv. geen "Gesponsord: Ja" of een
  // looptijd kiezen die 0 sites oplevert.
  const pBase = (s: BulkSite) => s.kind === linkType && (!q || s.domain.toLowerCase().includes(q) || s.niches.some((n) => n.toLowerCase().includes(q)));
  const pNiche = (s: BulkSite) => !niche || s.niches.includes(niche);
  const pLand = (s: BulkSite) => !land || s.country === land;
  const pTaal = (s: BulkSite) => !taal || s.language === taal;
  const pDr = (s: BulkSite) => atLeast(s.dr, minDr);
  const pDa = (s: BulkSite) => atLeast(s.da, minDa);
  const pTraffic = (s: BulkSite) => atLeast(s.traffic, minTraffic);
  const pLinks = (s: BulkSite) => atLeast(s.maxLinks, minLinks);
  const pSponsored = (s: BulkSite) => !sponsored || s.sponsored === (sponsored === "ja");
  const pDuur = (s: BulkSite) => !duur || s.periodic === (duur === "jaar");
  const pPrice = (s: BulkSite) => maxPrice === "" || s.price <= Number(maxPrice);
  const preds = [pBase, pNiche, pLand, pTaal, pDr, pDa, pTraffic, pLinks, pSponsored, pDuur, pPrice];
  const filtered = sites.filter((s) => preds.every((p) => p(s)));
  // Sites die matchen met álle filters behálve het opgegeven filter — de basis
  // voor de opties van dat filter (het eigen filter laten we weg, anders zou je
  // je eigen keuze wegfilteren).
  const facet = (self: (s: BulkSite) => boolean) => sites.filter((s) => preds.every((p) => p === self || p(s)));
  const nicheOptions = uniqSorted(facet(pNiche).flatMap((s) => s.niches));
  const landOptions = uniqSorted(facet(pLand).map((s) => s.country));
  const taalOptions = uniqSorted(facet(pTaal).map((s) => s.language));
  const sponsoredFacet = facet(pSponsored);
  const sponsoredOptions = [
    ...(sponsoredFacet.some((s) => s.sponsored) ? [{ value: "ja", name: "Ja" }] : []),
    ...(sponsoredFacet.some((s) => !s.sponsored) ? [{ value: "nee", name: "Nee" }] : []),
  ];
  const duurFacet = facet(pDuur);
  const duurOptions = [
    ...(duurFacet.some((s) => !s.periodic) ? [{ value: "permanent", name: "Permanent" }] : []),
    ...(duurFacet.some((s) => s.periodic) ? [{ value: "jaar", name: "Per jaar" }] : []),
  ];
  const hasFilter = [search, niche, land, taal, minDr, minDa, minTraffic, minLinks, sponsored, duur, maxPrice].some((v) => v !== "");
  const resetFilters = () => { setSearch(""); setNiche(""); setLand(""); setTaal(""); setMinDr(""); setMinDa(""); setMinTraffic(""); setMinLinks(""); setSponsored(""); setDuur(""); setMaxPrice(""); };
  const filterField = "rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand";
  // Compact inputs used in the inline filter row (desktop) and the mobile sheet.
  const ff = "w-full min-w-0 rounded-md border border-line bg-white px-2 py-1.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-brand";
  const numFilter = (val: string, set: (v: string) => void, placeholder = "≥") => (
    <input type="number" inputMode="numeric" min={0} value={val} onChange={(e) => set(e.target.value)} placeholder={placeholder} aria-label={placeholder === "≥" ? "vanaf" : "maximaal"} className={`${ff} text-right lg:w-[56px] ${val ? "border-brand font-semibold" : ""}`} />
  );
  const selFilter = (val: string, set: (v: string) => void, label: string, options: { value: string; name: string }[]) => {
    // Houd de huidige keuze altijd in de lijst, ook als 'ie door de andere
    // filters wegvalt — anders kun je 'm niet meer deselecteren.
    const opts = val && !options.some((o) => o.value === val) ? [{ value: val, name: val }, ...options] : options;
    return (
      <GreenSelect value={val} options={opts} onChange={set} emptyLabel="Alle" ariaLabel={label} className={`${ff} ${val ? "border-brand font-semibold" : ""}`} />
    );
  };
  const colFilter = (key: ColumnKey): ReactNode => {
    switch (key) {
      case "niche": return selFilter(niche, setNiche, "Niche", nicheOptions.map((n) => ({ value: n, name: n })));
      case "land": return selFilter(land, setLand, "Land", landOptions.map((n) => ({ value: n, name: n })));
      case "taal": return selFilter(taal, setTaal, "Taal", taalOptions.map((n) => ({ value: n, name: n })));
      case "dr": return numFilter(minDr, setMinDr);
      case "da": return numFilter(minDa, setMinDa);
      case "verkeer": return numFilter(minTraffic, setMinTraffic);
      case "maxlinks": return numFilter(minLinks, setMinLinks);
      case "gesponsord": return selFilter(sponsored, setSponsored, "Gesponsord", sponsoredOptions);
      case "duur": return selFilter(duur, setDuur, "Looptijd", duurOptions);
      default: return null;
    }
  };
  // The always-on columns, shown with a lock in the Kolommen-manager (like the
  // regular marktplaats) so it's clear they can't be switched off.
  const lockedCol = (name: string) => (
    <div className="flex items-center gap-2.5 px-2 py-1.5 text-sm text-inkSoft">
      <span className="flex h-4 w-4 items-center justify-center rounded border border-line bg-gray-100"><Check size={12} strokeWidth={3} className="text-inkSoft/70" /></span>
      <span className="flex-1">{name}</span>
      <Lock size={13} className="text-inkSoft/70" />
    </div>
  );

  if (sites.length === 0) {
    return <div className="rounded-xl border border-line bg-surface p-8 text-center text-sm text-inkSoft">Er zijn op dit moment geen sites beschikbaar.</div>;
  }
  return (
    <>
      {/* Zoekbalk + Type-filter + Filters (mobiel) + Kolommen-manager (desktop). */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Zoek op domein of niche…" className={`${filterField} w-full sm:w-64 sm:flex-none`} />
        {hasHomepage && (
          <div className="inline-flex rounded-lg border border-line bg-gray-50 p-0.5" role="radiogroup" aria-label="Type link">
            {([["blog", "Blog links"], ["homepage", "Homepage links"]] as ["blog" | "homepage", string][]).map(([val, label]) => (
              <button key={val} type="button" role="radio" aria-checked={linkType === val} onClick={() => setLinkType(val)} className={`relative whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${linkType === val ? "bg-surface text-[var(--btn-pay-bg)] shadow-sm ring-1 ring-black/5" : "text-inkSoft hover:text-ink"}`}>
                {label}
                {linkType === val && <span className="absolute inset-x-3 bottom-1 h-[2px] rounded-full bg-[var(--btn-pay-bg)]" aria-hidden />}
              </button>
            ))}
          </div>
        )}
        {topics.length > 0 && (
          <GreenSelect
            value={topicId}
            options={topics.map((t) => ({ value: t.id, name: t.name }))}
            onChange={onTopic}
            onClear={() => onTopic("")}
            emptyLabel="Algemeen"
            prefix="Prijzen voor:"
            ariaLabel="Prijzen voor onderwerp"
            className={`rounded-lg border bg-surface px-3 py-2 text-sm ${topicId ? "border-brand" : "border-line"}`}
          />
        )}
        <button type="button" onClick={() => setFiltersOpen((o) => !o)} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm lg:hidden ${hasFilter ? "border-brand font-semibold text-brand" : "border-line text-ink"}`}>
          <SlidersHorizontal size={15} /> Filters{hasFilter ? ` · ${[niche, land, taal, minDr, minDa, minTraffic, minLinks, sponsored, duur, maxPrice].filter(Boolean).length}` : ""}
        </button>
        {hasFilter && (
          <button type="button" onClick={resetFilters} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-inkSoft hover:bg-gray-50 hover:text-ink"><X size={14} /> Filters wissen</button>
        )}
        <div className="relative ml-auto hidden lg:block">
          <button type="button" onClick={() => setColsOpen((o) => !o)} className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink hover:bg-gray-50">
            <SlidersHorizontal size={15} /> Kolommen <span className="font-semibold">{shown.length}</span>
          </button>
          {colsOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setColsOpen(false)} />
              <div className="absolute right-0 z-40 mt-1 w-64 rounded-xl border border-line bg-surface p-2 shadow-lg">
                <p className="px-2 pb-1.5 pt-0.5 text-xs text-inkSoft">Vink aan wat je wilt zien; sleep om de volgorde te wijzigen.</p>
                {lockedCol("Aantal")}
                {lockedCol("Site")}
                {lockedCol("Prijs")}
                <div className="max-h-[55vh] overflow-y-auto border-y border-line py-1">
                  {columns.order.map((key) => (
                    <div
                      key={key}
                      draggable
                      onDragStart={() => setDragging(key)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => dropOn(key)}
                      onDragEnd={() => setDragging(null)}
                      className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-ink hover:bg-gray-50 ${dragging === key ? "opacity-40" : ""}`}
                    >
                      <GripVertical size={14} className="shrink-0 cursor-grab text-inkSoft/50" />
                      <label className="flex flex-1 cursor-pointer items-center gap-2.5">
                        <input type="checkbox" checked={columns.shown.includes(key)} onChange={() => toggleShown(key)} className="h-4 w-4 accent-[var(--btn-pay-bg)]" />
                        {COL_LABEL[key]}
                      </label>
                    </div>
                  ))}
                </div>
                <div className="mt-1 border-t border-line px-2 pt-2">
                  <button type="button" onClick={() => onColumns(DEFAULT_COLUMNS)} className="text-[13px] font-medium text-inkSoft underline underline-offset-2 hover:text-ink">Standaard herstellen</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Mobiel: filters als uitklapbaar paneel (desktop heeft de filterrij). */}
      {filtersOpen && (
        <div className="mb-3 grid grid-cols-2 gap-2 rounded-xl border border-line bg-surface p-3 lg:hidden">
          <label className="text-xs text-inkSoft">Niche{selFilter(niche, setNiche, "Niche", nicheOptions.map((n) => ({ value: n, name: n })))}</label>
          <label className="text-xs text-inkSoft">Land{selFilter(land, setLand, "Land", landOptions.map((n) => ({ value: n, name: n })))}</label>
          <label className="text-xs text-inkSoft">Taal{selFilter(taal, setTaal, "Taal", taalOptions.map((n) => ({ value: n, name: n })))}</label>
          <label className="text-xs text-inkSoft">Gesponsord{selFilter(sponsored, setSponsored, "Gesponsord", sponsoredOptions)}</label>
          <label className="text-xs text-inkSoft">DR vanaf{numFilter(minDr, setMinDr)}</label>
          <label className="text-xs text-inkSoft">DA vanaf{numFilter(minDa, setMinDa)}</label>
          <label className="text-xs text-inkSoft">Verkeer vanaf{numFilter(minTraffic, setMinTraffic)}</label>
          <label className="text-xs text-inkSoft">Max. links vanaf{numFilter(minLinks, setMinLinks)}</label>
          <label className="text-xs text-inkSoft">Looptijd{selFilter(duur, setDuur, "Looptijd", duurOptions)}</label>
          <label className="text-xs text-inkSoft">Max. prijs{numFilter(maxPrice, setMaxPrice, "≤")}</label>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="mb-3 rounded-xl border border-line bg-surface p-6 text-center text-sm text-inkSoft">
          Geen sites gevonden met deze filters. <button type="button" onClick={resetFilters} className="font-semibold text-brand hover:underline">Wis filters</button>
        </div>
      )}
      <div className="hidden overflow-x-auto rounded-xl border border-line bg-surface lg:block">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-semibold text-inkSoft">
              <th className="sticky left-0 z-20 w-[132px] min-w-[132px] bg-gray-50 px-4 py-3 whitespace-nowrap">Aantal</th>
              <th className="sticky left-[132px] z-20 w-[190px] min-w-[190px] bg-gray-50 px-4 py-3 whitespace-nowrap">Site</th>
              <th className="sticky left-[322px] z-20 w-[104px] min-w-[104px] bg-gray-50 border-r border-line px-4 py-3 text-left whitespace-nowrap">Prijs</th>
              {shown.map((k) => <th key={k} className={`px-4 py-3 whitespace-nowrap ${COL_RIGHT.has(k) ? "text-right" : ""}`}>{COL_LABEL[k]}</th>)}
              {/* Lege opvul-kolom: pakt de resterende breedte op, zodat de tabel
                  de volle breedte vult zonder de echte kolommen te vervormen. */}
              <th className="w-full bg-gray-50" aria-hidden />
            </tr>
            <tr className="bg-gray-50 text-left text-xs font-semibold text-inkSoft">
              <th className="sticky left-0 z-20 w-[132px] min-w-[132px] bg-gray-50 px-3 py-1.5"></th>
              <th className="sticky left-[132px] z-20 w-[190px] min-w-[190px] bg-gray-50 px-3 py-1.5"></th>
              <th className="sticky left-[322px] z-20 w-[104px] min-w-[104px] bg-gray-50 border-r border-line px-2 py-1.5 align-top">{numFilter(maxPrice, setMaxPrice, "≤")}</th>
              {shown.map((k) => <th key={k} className="px-3 py-1.5 align-top">{colFilter(k)}</th>)}
              <th className="bg-gray-50" aria-hidden />
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
                  <tr onClick={() => toggleDetails(s.id)} aria-expanded={open} className={`group cursor-pointer border-t border-line text-sm ${n > 0 ? "bg-[#f1f9f4]" : ""}`}>
                    <td className={`sticky left-0 z-10 w-[132px] min-w-[132px] px-4 py-3 ${n > 0 ? "bg-[#f1f9f4]" : "bg-surface"}`} onClick={(e) => e.stopPropagation()}>
                      <div className={`inline-flex items-center overflow-hidden rounded-lg border ${n > 0 ? "border-[var(--btn-pay-bg)]" : "border-line"}`}>
                        <button type="button" disabled={n === 0 || pending.has(s.id)} onClick={() => onRemove(s.id)} className="flex h-8 w-8 items-center justify-center text-inkSoft hover:bg-gray-50 disabled:opacity-30"><Minus size={14} /></button>
                        <span className={`w-8 text-center text-sm font-bold tabular-nums ${n > 0 ? "text-[var(--btn-pay-bg)]" : "text-inkSoft/50"}`}>{n}</span>
                        <button type="button" disabled={pending.has(s.id)} onClick={() => onAdd(s.id)} className="flex h-8 w-8 items-center justify-center text-inkSoft hover:bg-gray-50 disabled:opacity-30"><Plus size={14} /></button>
                      </div>
                    </td>
                    <td className={`sticky left-[132px] z-10 w-[190px] min-w-[190px] px-4 py-3 ${n > 0 ? "bg-[#f1f9f4]" : "bg-surface"}`}>
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate font-semibold text-ink">{s.domain}</span>
                        <a onClick={(e) => e.stopPropagation()} href={`https://${s.domain}`} target="_blank" rel="noreferrer" className="shrink-0 text-inkSoft/60 hover:text-ink" aria-label={`Open ${s.domain}`}><ExternalLink size={13} /></a>
                      </div>
                    </td>
                    <td className={`sticky left-[322px] z-10 w-[104px] min-w-[104px] border-r border-line px-4 py-3 text-left ${n > 0 ? "bg-[#f1f9f4]" : "bg-surface"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="whitespace-nowrap font-semibold tabular-nums text-ink">{euro(s.price)}</span>
                        <ChevronDown size={16} className={`shrink-0 text-inkSoft/50 transition-transform ${open ? "rotate-180" : ""}`} />
                      </div>
                    </td>
                    {shown.map((k) => <td key={k} className={`px-4 py-3 whitespace-nowrap group-hover:bg-gray-50/60 ${COL_RIGHT.has(k) ? "text-right" : ""}`}>{bulkCell(s, k)}</td>)}
                    <td className="group-hover:bg-gray-50/60" aria-hidden />
                  </tr>
                  {open && (
                    <tr>
                      <td colSpan={shown.length + 4} className="border-t border-line bg-brandSoft/20 p-0">
                        <div className="sticky left-0 w-[min(100%,920px)] px-4 py-4">
                          <SiteDetails s={s} />
                        </div>
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
      <div className="space-y-2.5 lg:hidden">
        {filtered.map((s) => {
          const n = qty[s.id] ?? 0;
          return (
            <div key={s.id} className={`rounded-xl border p-3 ${n > 0 ? "border-[var(--btn-pay-bg)]/40 bg-[#f1f9f4]" : "border-line bg-surface"}`}>
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
                  <button type="button" disabled={n === 0 || pending.has(s.id)} onClick={() => onRemove(s.id)} className="flex h-8 w-8 items-center justify-center text-inkSoft hover:bg-gray-50 disabled:opacity-30"><Minus size={15} /></button>
                  <span className={`w-8 text-center text-sm font-bold tabular-nums ${n > 0 ? "text-[var(--btn-pay-bg)]" : "text-inkSoft/50"}`}>{n}</span>
                  <button type="button" disabled={pending.has(s.id)} onClick={() => onAdd(s.id)} className="flex h-8 w-8 items-center justify-center text-inkSoft hover:bg-gray-50 disabled:opacity-30"><Plus size={15} /></button>
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

      {/* Kiezen is een selectieveld — geen totaal/telling hier, alleen de knop
          (het bedrag en overzicht staan op "Bevestigen"). */}
      <div className="mt-4 flex justify-end">
        <button type="button" disabled={selectedArticles === 0} onClick={onNext} className="btn-pay w-full rounded-full px-6 py-3 text-sm font-semibold transition disabled:opacity-40 sm:w-auto">
          {selectedArticles === 0
            ? <>Selecteer sites om verder te gaan</>
            : remainingToFill > 0 && remainingToFill < selectedArticles
              ? <>Nog {remainingToFill} invullen &rarr;</>
              : <>{selectedArticles} {selectedArticles === 1 ? "plaatsing" : "plaatsingen"} invullen &rarr;</>}
        </button>
      </div>
    </>
  );
}

// Eigen dropdown i.p.v. een native <select>, zodat de highlight onze huisstijl-
// groene kleur is (de systeem-dropdown is standaard blauw en niet te stylen).
// De lijst gaat via een portal op body met fixed-positie, zodat 'ie niet door
// de scrollende tabel (overflow) wordt afgekapt; sluit bij klik-buiten, Escape
// of scrollen.
function GreenSelect({
  value,
  options,
  onChange,
  placeholder,
  emptyLabel,
  ariaLabel,
  className = "",
  prefix,
  onClear,
}: {
  value: string;
  options: { value: string; name: string }[];
  onChange: (v: string) => void;
  placeholder?: string;
  // Als gezet, is "" een kiesbare optie met dit label (bijv. "Alle" / "Algemeen").
  emptyLabel?: string;
  ariaLabel: string;
  className?: string;
  // Gedempt label vóór de waarde (bijv. "Prijzen voor:").
  prefix?: string;
  // Toont een wis-knopje zodra er een waarde is (i.p.v. het chevron).
  onClear?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const allOptions = emptyLabel !== undefined ? [{ value: "", name: emptyLabel }, ...options] : options;
  const current = allOptions.find((o) => o.value === value);
  const place = () => { const r = btnRef.current?.getBoundingClientRect(); if (r) setRect({ top: r.bottom, left: r.left, width: r.width }); };
  useEffect(() => {
    if (!open) return;
    place();
    const onDown = (e: MouseEvent) => { if (!btnRef.current?.contains(e.target as Node) && !popRef.current?.contains(e.target as Node)) setOpen(false); };
    const onScroll = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); window.removeEventListener("scroll", onScroll, true); window.removeEventListener("resize", onScroll); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <>
      <button ref={btnRef} type="button" aria-haspopup="listbox" aria-expanded={open} aria-label={ariaLabel} onClick={() => setOpen((o) => !o)} className={`inline-flex items-center gap-1.5 text-left ${className}`}>
        {prefix && <span className="shrink-0 text-inkSoft">{prefix}</span>}
        <span className={`min-w-0 flex-1 truncate ${current && current.value ? "font-semibold text-ink" : prefix ? "font-semibold text-ink" : "text-inkSoft"}`}>{current?.name ?? placeholder ?? ""}</span>
        {onClear && value ? (
          <span role="button" tabIndex={0} aria-label="Wissen" onClick={(e) => { e.stopPropagation(); onClear(); setOpen(false); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onClear(); setOpen(false); } }} className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-inkSoft hover:bg-gray-100 hover:text-ink"><X size={11} /></span>
        ) : (
          <ChevronDown size={14} className={`shrink-0 text-inkSoft transition-transform ${open ? "rotate-180" : ""}`} />
        )}
      </button>
      {open && rect && typeof document !== "undefined" && createPortal(
        <div ref={popRef} role="listbox" aria-label={ariaLabel} style={{ position: "fixed", top: rect.top + 4, left: rect.left, minWidth: rect.width }} className="z-[60] max-h-64 w-max max-w-[260px] overflow-auto rounded-lg border border-line bg-surface py-1 shadow-lg">
          {allOptions.map((o) => {
            const sel = o.value === value;
            return (
              <button key={o.value || "__empty"} type="button" role="option" aria-selected={sel} onClick={() => { onChange(o.value); setOpen(false); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-ink transition-colors hover:bg-[var(--btn-pay-bg)] hover:text-white">
                <span className="flex w-4 shrink-0 justify-center">{sel && <Check size={14} strokeWidth={2.5} />}</span>
                <span className="min-w-0 flex-1 truncate">{o.name}</span>
              </button>
            );
          })}
        </div>,
        document.body
      )}
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

  // Zodra er een project gekozen is (ook net aangemaakt) sluit de naam-invoer —
  // zo blijft "Naam nieuwe klant…" nooit hangen na opslaan.
  useEffect(() => {
    if (value) { setCreating(false); setName(""); setErr(null); }
  }, [value]);

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
    // Sluit eerst lokaal, dan de parent informeren — zo kan een her-render in de
    // parent de create-stand niet open laten staan.
    setCreating(false);
    setName("");
    onCreated(res.project);
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

  // Alleen een lege ("") keuze aanbieden als dat mag, of als er nog niets
  // gekozen is — net als de oude native <select>.
  const showEmpty = Boolean(placeholder) && (allowEmpty || value === "");
  return (
    <GreenSelect
      value={value}
      options={[
        ...projects.map((p) => ({ value: p.id, name: p.name })),
        { value: "__new__", name: "+ Nieuw project…" },
      ]}
      onChange={(v) => {
        if (v === "__new__") { setErr(null); setCreating(true); }
        else onChange(v);
      }}
      emptyLabel={showEmpty ? placeholder : undefined}
      placeholder={placeholder}
      ariaLabel={placeholder ?? "Project kiezen"}
      className={className}
    />
  );
}

// The pop-up body for "Zelf aanleveren → tekst": title + rich text + an optional
// image (own upload or Pixabay search) — the same building blocks as the
// regular order form.
function TextDelivery({ a, onUpdate }: { a: Article; onUpdate: (patch: Partial<Article>) => void }) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
  const [docNotice, setDocNotice] = useState<string | null>(null);
  // Which way you're delivering: type the text, or paste a Google Doc link —
  // the same toggle as the regular order form.
  const [mode, setMode] = useState<"text" | "doc">(a.docUrl.trim() && !a.body.trim() ? "doc" : "text");
  const previewUrl = a.imageKey ? `/api/article-images/${a.imageKey}` : null;
  async function uploadFile(file: File | null) {
    if (!file) return;
    setErr(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/upload/article-image", { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok) { setErr(body.error ?? "Uploaden van afbeelding mislukt."); return; }
      onUpdate({ imageKey: body.key });
    } catch {
      setErr("Uploaden van afbeelding mislukt. Probeer het opnieuw.");
    } finally {
      setUploading(false);
    }
  }
  async function ophalen() {
    setDocError(null);
    setDocNotice(null);
    setFetching(true);
    try {
      const res = await fetchGoogleDocAction(a.docUrl);
      if (!res.success) { setDocError(res.error ?? "Ophalen mislukt."); return; }
      onUpdate({ title: res.title || a.title, body: res.body ?? "" });
      setMode("text");
      setDocNotice("Titel en tekst opgehaald uit de Google Doc. Pas gerust aan.");
    } catch {
      setDocError("Ophalen mislukt. Probeer het opnieuw.");
    } finally {
      setFetching(false);
    }
  }
  const seg = (active: boolean) => `rounded-md px-4 py-1.5 text-sm transition-colors ${active ? "bg-surface font-semibold text-ink shadow-sm" : "font-medium text-inkSoft hover:text-ink"}`;
  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border border-line bg-gray-50 p-0.5">
        <button type="button" onClick={() => setMode("text")} className={seg(mode === "text")}>Tekst typen</button>
        <button type="button" onClick={() => setMode("doc")} className={seg(mode === "doc")}>Google Doc-link</button>
      </div>

      {mode === "doc" ? (
        <div>
          <label className="mb-1 block text-sm text-ink">Google Doc-link</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input className={`${fieldCls} flex-1`} placeholder="https://docs.google.com/document/…" value={a.docUrl} onChange={(e) => { onUpdate({ docUrl: e.target.value }); setDocError(null); setDocNotice(null); }} />
            <button type="button" onClick={ophalen} disabled={fetching || !a.docUrl.trim()} className="btn-pay shrink-0 rounded-md px-4 py-2 text-sm font-semibold transition disabled:opacity-40">{fetching ? "Ophalen…" : "Ophalen"}</button>
          </div>
          <p className="mt-1 text-xs text-inkSoft">Deel de doc als &ldquo;iedereen met de link&rdquo;. Met <span className="font-medium">Ophalen</span> komen titel + tekst in &ldquo;Tekst typen&rdquo;, waar je ze kunt bijwerken en een afbeelding kunt toevoegen.</p>
          {docError && <p className="mt-1 text-xs text-red-600">{docError}</p>}
          {docNotice && <p className="mt-1 text-xs text-emerald-700">{docNotice}</p>}
        </div>
      ) : (
        <>
          <div>
            <label className="mb-1 block text-sm text-ink">Titel</label>
            <input className={fieldCls} placeholder="Waar gaat het artikel over?" value={a.title} onChange={(e) => onUpdate({ title: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-ink">Tekst</label>
            <RichTextEditor value={a.body} onChange={(html) => onUpdate({ body: html })} placeholder="Plak of typ hier je artikel…" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-ink">Afbeelding <span className="text-inkSoft/70">(optioneel)</span></label>
            {previewUrl ? (
              <div className="flex items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt="" className="h-20 w-32 shrink-0 rounded-md border border-line object-cover" />
                <button type="button" onClick={() => onUpdate({ imageKey: "" })} className="text-sm font-semibold text-red-600 hover:underline">Verwijderen</button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => uploadFile(e.target.files?.[0] ?? null)} disabled={uploading} className="text-sm" />
                  <p className="mt-1 text-xs text-inkSoft">{uploading ? "Afbeelding uploaden…" : "Max 2MB — PNG, JPG, WEBP of GIF."}</p>
                </div>
                <PhotoPicker onPicked={(key) => onUpdate({ imageKey: key })} />
              </div>
            )}
            {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
          </div>
        </>
      )}
    </div>
  );
}

// The pop-up body for "Laat ons schrijven": the link(s) we write the article
// around — one ankertekst + doel-URL, optionally a second link.
function LinkDelivery({ a, maxLinks, onUpdate }: { a: Article; maxLinks: number; onUpdate: (patch: Partial<Article>) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm text-ink">Ankertekst</label>
        <input className={fieldCls} placeholder="bv. beste autoverzekering" value={a.anchor} onChange={(e) => onUpdate({ anchor: e.target.value })} />
      </div>
      <div>
        <label className="mb-1 block text-sm text-ink">Doel-URL</label>
        <input className={fieldCls} placeholder="https://jouwsite.nl/pagina" value={a.url} onChange={(e) => onUpdate({ url: e.target.value })} />
      </div>
      {maxLinks > 1 && (
        a.secondLink ? (
          <div className="space-y-3 rounded-lg border border-line bg-gray-50/50 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-ink">Tweede link</span>
              <button type="button" onClick={() => onUpdate({ secondLink: false })} className="text-xs font-semibold text-inkSoft hover:text-red-600 hover:underline">Verwijderen</button>
            </div>
            <div>
              <label className="mb-1 block text-sm text-ink">Ankertekst 2</label>
              <input className={fieldCls} placeholder="ankertekst" value={a.anchor2} onChange={(e) => onUpdate({ anchor2: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-ink">Doel-URL 2</label>
              <input className={fieldCls} placeholder="https://…" value={a.url2} onChange={(e) => onUpdate({ url2: e.target.value })} />
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => onUpdate({ secondLink: true })} className="text-sm font-semibold text-brand hover:underline">+ Tweede link in dit artikel</button>
        )
      )}
      <p className="text-xs text-inkSoft">Je mag tot &ldquo;max. links&rdquo; links in één artikel verwerken. We schrijven het artikel rond je link(s).</p>
    </div>
  );
}

// De "Project"-kolomkop met "(optioneel)" en een (i) die uitlegt waarvoor het
// dient. De tekst in de tooltip staat bewust normal-case, los van de uppercase
// kolomkoppen eromheen.
function ProjectLabel() {
  // Tooltip zweeft bóven de (i) en rendert via een portal in de body, zodat de
  // tabel (met overflow) hem niet afkapt.
  const [tip, setTip] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLButtonElement>(null);
  const show = () => { const r = ref.current?.getBoundingClientRect(); if (r) setTip({ top: r.top, left: r.left + r.width / 2 }); };
  const hide = () => setTip(null);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-flex items-center gap-0.5">
        Project
        <button ref={ref} type="button" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide} aria-label="Waarvoor is een project?" className="inline-flex cursor-help items-center text-inkSoft/50 outline-none transition-colors hover:text-ink focus-visible:text-ink">
          <Info size={13} />
        </button>
      </span>
      <span className="font-normal normal-case tracking-normal text-inkSoft/60">(optioneel)</span>
      {tip && typeof document !== "undefined" && createPortal(
        <span role="tooltip" style={{ position: "fixed", top: tip.top - 8, left: tip.left, transform: "translate(-50%, -100%)" }} className="pointer-events-none z-50 block w-60 max-w-[16rem] rounded-lg border border-line bg-surface px-3 py-2.5 text-[11px] font-normal normal-case leading-relaxed tracking-normal text-ink shadow-lg">
          <span className="mb-1 block font-semibold text-ink">Waarvoor is een project?</span>
          Groepeer plaatsingen onder je eigen project — bijvoorbeeld per klant of campagne. Puur voor jouw overzicht; invullen is niet verplicht.
        </span>,
        document.body
      )}
    </span>
  );
}

function FillStep({ articles, projects, schedule, siteById, onUpdate, onRemove, onAddSites, onSetAllProject, onSetAllType, onAddProject, writingFee, sum, onEdit, onNext }: { articles: Article[]; projects: BulkProject[]; schedule: { min: string; max: string }; siteById: (id: string) => BulkSite; onUpdate: (id: string, patch: Partial<Article>) => void; onRemove: (id: string) => void; onAddSites: () => void; onSetAllProject: (projectId: string) => void; onSetAllType: (type: ArticleType) => void; onAddProject: (p: BulkProject) => void; writingFee: number; sum: number; onEdit: (id: string) => void; onNext: () => void }) {
  const missingType = articles.filter((a) => !a.type).length;
  // "Laat ons schrijven" needs the link(s) we write around: anchor + doel-URL.
  const incompleteWrite = articles.filter((a) => a.type === "write" && !hasWriteLink(a)).length;
  // "Zelf aanleveren" needs the article itself; zonder inhoud kan de order niet
  // door (kies "Later aanleveren" om bewust uit te stellen). Zo blokkeert de CTA
  // consistent: elke gele "todo"-regel houdt je tegen, niet alleen schrijf-regels.
  const incompleteSelf = articles.filter((a) => a.type === "self" && !hasSelfContent(a)).length;
  // Regels die nog actie nodig hebben (geel). Voedt zowel de blokkering als de
  // hint in de actiebalk, zodat de gebruiker ziet hoeveel er nog moet.
  const remaining = missingType + incompleteWrite + incompleteSelf;
  const blocked = articles.length === 0 || remaining > 0;
  // Uitleg bij de uitgeschakelde CTA — als tooltip (geen vast kleurvlak in de
  // balk). De voortgang zelf toont de stepper al met de X/totaal-badge.
  const blockHint = remaining > 0
    ? `Nog ${remaining} ${remaining === 1 ? "regel" : "regels"} invullen voordat je verder kunt`
    : "Voeg eerst een site toe";
  // What the project picker shows — so a chosen project stays visible instead of
  // snapping back to the placeholder.
  const [quickProject, setQuickProject] = useState("");
  const quickSel = "w-full rounded-md border border-line bg-surface px-2.5 py-2 text-sm font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-brand";
  // Regels die nog actie nodig hebben (geel) zoveel mogelijk bovenaan; ingevulde
  // regels zakken eronder. Stabiele sort, dus binnen elke groep blijft de
  // oorspronkelijke volgorde behouden.
  const orderedArticles = [...articles].sort((a, b) => (rowStatus(a) === "todo" ? 0 : 1) - (rowStatus(b) === "todo" ? 0 : 1));
  // One button per row in the "Inhoud" column. No "manier" chosen yet → one
  // yellow "Actie nodig" button that opens the popup (where you first pick how
  // you deliver); once chosen it becomes "+ toevoegen" / the green done-button.
  const inhoudCell = (a: Article, full: boolean) => {
    const doneCls = full ? `${doneBtnCls} flex-1` : doneBtnCls;
    // Losse "Volgt later" (geen pennetje ernaast): op mobiel vol-breed, net als
    // de "+ toevoegen"-knoppen.
    const doneSolo = full ? doneBtnCls.replace("w-[195px]", "w-full") : doneBtnCls;
    const addCls = full ? `${addBtnCls} w-full` : addBtnCls;
    const actCls = full ? `${actionBtnCls} w-full` : actionBtnCls;
    const pencil = (
      <button type="button" onClick={() => onEdit(a.id)} className={`flex ${full ? "h-10 w-10" : "h-9 w-9"} shrink-0 items-center justify-center rounded-lg border border-line text-inkSoft hover:bg-brandSoft hover:text-ink`} aria-label="Bewerken"><Pencil size={15} /></button>
    );
    // Homepage link: alleen een link (ankertekst + doel-URL) of "Later aanleveren".
    if (siteById(a.siteId).kind === "homepage") {
      if (a.type === "later") return <div className="flex items-center gap-2"><button type="button" onClick={() => onEdit(a.id)} className={doneCls}><Check size={16} strokeWidth={2.5} /> Inhoud volgt later</button>{pencil}</div>;
      if (hasWriteLink(a)) return <div className="flex items-center gap-2"><button type="button" onClick={() => onEdit(a.id)} className={doneCls}><Check size={16} strokeWidth={2.5} /> Link toegevoegd</button>{pencil}</div>;
      return <button type="button" onClick={() => onEdit(a.id)} className={actCls}><AlertTriangle size={16} /> Link toevoegen</button>;
    }
    if (!a.type) return <button type="button" onClick={() => onEdit(a.id)} className={actCls}><AlertTriangle size={16} /> Inhoud toevoegen</button>;
    if (a.type === "later") return <button type="button" onClick={() => onEdit(a.id)} className={doneSolo}><Check size={16} strokeWidth={2.5} /> Inhoud volgt later</button>;
    if (a.type === "self")
      return hasSelfContent(a) ? (
        <div className="flex items-center gap-2"><button type="button" onClick={() => onEdit(a.id)} className={doneCls}><Check size={16} strokeWidth={2.5} /> Artikel toegevoegd</button>{pencil}</div>
      ) : (
        <button type="button" onClick={() => onEdit(a.id)} className={addCls}><AlertTriangle size={16} /> Artikel toevoegen</button>
      );
    return hasWriteLink(a) ? (
      <div className="flex items-center gap-2"><button type="button" onClick={() => onEdit(a.id)} className={doneCls}><Check size={16} strokeWidth={2.5} /> {hasSecondWriteLink(a) ? "Links toegevoegd" : "Link toegevoegd"}</button>{pencil}</div>
    ) : (
      <button type="button" onClick={() => onEdit(a.id)} className={addCls}><AlertTriangle size={16} /> Link toevoegen</button>
    );
  };
  return (
    <>
      {(
        <div className="mb-4 flex flex-col gap-2 border-b border-line pb-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <span className="shrink-0 text-sm font-semibold text-inkSoft">Snel invullen op alle regels</span>
          <div className="grid gap-2 sm:w-[600px] sm:min-w-0 sm:grid-cols-2">
            <GreenSelect
              value=""
              options={[
                { value: "write", name: "Laat ons schrijven" },
                { value: "self", name: "Zelf aanleveren" },
                { value: "later", name: "Later aanleveren" },
              ]}
              onChange={(v) => v && onSetAllType(v as ArticleType)}
              placeholder="Manier van aanleveren…"
              ariaLabel="Manier van aanleveren op alle regels"
              className={quickSel}
            />
            <ProjectSelect
              value={quickProject}
              projects={projects}
              onChange={(id) => { setQuickProject(id); if (id) onSetAllProject(id); }}
              onCreated={(p) => { onAddProject(p); setQuickProject(p.id); onSetAllProject(p.id); }}
              className={quickSel}
              placeholder="Kies project…"
            />
          </div>
        </div>
      )}

      <div className="hidden overflow-x-auto rounded-xl border border-line bg-surface xl:block">
        <table className="w-full min-w-[760px] table-fixed">
          <thead>
            <tr className="bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wide text-inkSoft">
              <th className="w-[24%] px-3 py-2.5">Website</th>
              <th className="w-[30%] px-3 py-2.5">Inhoud</th>
              <th className="w-[26%] px-3 py-2.5"><ProjectLabel /></th>
              <th className="w-[14%] px-3 py-2.5 text-right">Prijs</th>
              <th className="w-[6%] px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {orderedArticles.map((a, i) => {
              const site = siteById(a.siteId);
              return (
                <tr key={a.id} className="border-t border-line align-top text-sm">
                  <td className={`border-l-4 px-3 py-3 align-top ${STATUS_EDGE[rowStatus(a)]}`}>
                    <div className="flex items-center gap-1.5">
                      <span className="shrink-0 text-xs font-semibold tabular-nums text-inkSoft/60">{i + 1}.</span>
                      <span className="truncate font-semibold text-ink" title={site.domain}>{site.domain}</span>
                      <a href={`https://${site.domain}`} target="_blank" rel="noreferrer" className="shrink-0 text-inkSoft/60 hover:text-ink" aria-label={`Open ${site.domain}`}><ExternalLink size={12} /></a>
                    </div>
                  </td>
                  <td className="px-3 py-3 align-top">
                    {inhoudCell(a, false)}
                  </td>
                  <td className="px-3 py-3 align-top">
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
                  <td className="whitespace-nowrap px-3 py-3 text-right align-top">
                    <span className="text-base font-medium tabular-nums text-ink">{euro(site.price + (a.type === "write" && site.kind === "blog" ? writingFee : 0))}</span>
                    {a.type === "write" && site.kind === "blog" && writingFee > 0 && <span className="block text-[11px] font-medium text-inkSoft">incl. {euro(writingFee)} schrijven</span>}
                  </td>
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
      <div className="space-y-3 xl:hidden">
        {orderedArticles.map((a, i) => {
          const site = siteById(a.siteId);
          const lbl = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-inkSoft";
          return (
            <div key={a.id} className={`rounded-xl border border-l-4 border-line bg-surface p-3 ${STATUS_EDGE[rowStatus(a)]}`}>
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-[11px] font-bold text-inkSoft">{i + 1}</span>
                  <span className="font-semibold text-ink">{site.domain}</span>
                  <a href={`https://${site.domain}`} target="_blank" rel="noreferrer" className="text-inkSoft/60 hover:text-ink" aria-label={`Open ${site.domain}`}><ExternalLink size={12} /></a>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-base font-medium tabular-nums text-ink">{euro(site.price + (a.type === "write" && site.kind === "blog" ? writingFee : 0))}</span>
                    {a.type === "write" && site.kind === "blog" && writingFee > 0 && <span className="block text-[10px] font-medium text-inkSoft">incl. {euro(writingFee)} schrijven</span>}
                  </div>
                  <button type="button" onClick={() => onRemove(a.id)} className="text-inkSoft hover:text-red-600" aria-label="Verwijderen"><Trash2 size={16} /></button>
                </div>
              </div>
              <div className="space-y-2">
                <div>
                  <label className={lbl}>Inhoud</label>
                  {inhoudCell(a, true)}
                </div>
                <div>
                  <label className={lbl}><ProjectLabel /></label>
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
              </div>
            </div>
          );
        })}
      </div>

      {/* Plakkende actiebalk: totaal + CTA blijven onderin in beeld, ook bij
          veel regels — zo hoef je niet naar beneden te scrollen om verder te
          kunnen. Sticky (niet fixed), dus past zich vanzelf aan een uit-/
          ingeklapt menu en aan mobiel aan. */}
      <div className="sticky bottom-0 z-20 mt-3">
        <div style={{ transform: "translateZ(0)" }} className="rounded-xl border border-line bg-surface px-4 py-3 shadow-[0_-2px_14px_rgba(0,0,0,0.07)]">
          {/* Mobiel: totaal bovenaan rechts (sluit de plaatsingsprijzen-kolom af)
              met een dun scheidslijntje; daaronder twee even brede knoppen die
              samen de regel vullen ("Meer sites selecteren" + CTA) — zo geen gat
              en passen de volledige labels op één regel, ook op smalle telefoons. */}
          <div className="sm:hidden">
            <div className="flex items-baseline justify-end gap-2 border-b border-line pb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-inkSoft">Totaal</span>
              <span key={euro(sum)} className="text-lg font-extrabold tabular-nums text-ink">{euro(sum)}</span>
              <span className="text-xs text-inkSoft">ex. btw</span>
            </div>
            <div className="mt-2 flex items-center gap-2.5">
              {/* Secundair: klein en gedempt — "Naar bevestigen" is de hoofdactie
                  en krijgt de ruimte en het gewicht. */}
              <button type="button" onClick={onAddSites} className="flex shrink-0 items-center gap-0.5 whitespace-nowrap text-xs font-medium text-inkSoft/80 transition hover:text-ink"><Plus size={13} className="shrink-0" /> Meer sites selecteren</button>
              <span className="flex-1" title={blocked ? blockHint : undefined}>
                <button type="button" disabled={blocked} onClick={onNext} className="btn-pay w-full whitespace-nowrap rounded-full py-2.5 text-sm font-semibold transition disabled:opacity-40">Naar bevestigen &rarr;</button>
              </span>
            </div>
          </div>
          {/* Desktop/tablet: zelfde opbouw als mobiel — totaal bovenaan rechts
              met een scheidslijntje, daaronder "Meer sites" links + CTA rechts. */}
          <div className="hidden sm:block">
            <div className="flex items-baseline justify-end gap-2 border-b border-line pb-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-inkSoft">Totaal</span>
              <span key={euro(sum)} className="text-lg font-extrabold tabular-nums text-ink">{euro(sum)}</span>
              <span className="text-xs text-inkSoft">ex. btw</span>
            </div>
            <div className="mt-2.5 flex items-center justify-between gap-4">
              <button type="button" onClick={onAddSites} className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-inkSoft transition hover:bg-gray-100 hover:text-ink"><Plus size={16} className="shrink-0" /> Meer sites selecteren</button>
              {/* Span eromheen zodat de tooltip ook boven de uitgeschakelde knop
                  verschijnt (een disabled button toont zelf geen title). */}
              <span title={blocked ? blockHint : undefined}>
                <button type="button" disabled={blocked} onClick={onNext} className="btn-pay rounded-full px-5 py-2.5 text-sm font-semibold transition disabled:opacity-40">Naar bevestigen &rarr;</button>
              </span>
            </div>
          </div>
        </div>
      </div>

    </>
  );
}

// De bewerk-popup voor één regel. Staat los zodat zowel Invullen als
// Bevestigen (het pennetje) hem kan openen; op mobiel schermvullend, op
// desktop een nette gecentreerde dialog met achtergrond.
function EditArticleModal({ a, siteById, writingFee, schedule, projects, lockType = false, onUpdate, onAddProject, onClose }: { a: Article; siteById: (id: string) => BulkSite; writingFee: number; schedule: { min: string; max: string }; projects: BulkProject[]; lockType?: boolean; onUpdate: (id: string, patch: Partial<Article>) => void; onAddProject: (p: BulkProject) => void; onClose: () => void }) {
  const site = siteById(a.siteId);
  // Wijzigingen worden live weggeschreven. Bij Bevestigen (lockType) zet het
  // kruisje/weg-klikken de regel exact terug zoals 'ie bij openen was, zodat je
  // vlak voor bestellen nooit een regel "kapotter" achterlaat dan je begon. Bij
  // Invullen blijft sluiten gewoon sluiten (een half-ingevulde regel mag je
  // daar laten staan en later hervatten). De key per regel-id garandeert dat
  // de snapshot altijd de stand bij openen is.
  const initialRef = useRef<Article>(a);
  const cancel = () => { if (lockType) onUpdate(a.id, initialRef.current); onClose(); };
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-surface sm:flex sm:items-center sm:justify-center sm:overflow-visible sm:bg-black/40 sm:p-6"
      onPointerDown={(e) => { if (e.target === e.currentTarget) cancel(); }}
    >
      <div className="flex min-h-full flex-col bg-surface sm:min-h-0 sm:max-h-[85vh] sm:w-full sm:max-w-3xl sm:rounded-2xl sm:border sm:border-line sm:shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-4 py-3 sm:px-6">
          <h3 className="font-serif text-lg text-ink">{site.kind === "homepage" ? "Homepage link" : "Inhoud"} voor {site.domain}</h3>
          <button type="button" onClick={cancel} className="text-inkSoft hover:text-ink" aria-label="Annuleren"><X size={20} /></button>
        </div>
        <div className="px-4 py-5 sm:flex-1 sm:overflow-y-auto sm:px-6">
          {/* Step 1: how do you deliver? Homepage links are just a link (or
              later); blog links have the write/self/later choice. */}
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-inkSoft">Hoe lever je aan?</label>
          <div className={`grid gap-2 ${lockType ? "" : site.kind === "homepage" ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
            {((site.kind === "homepage"
              ? [
                  ["write", "Link invullen", "Ankertekst + doel-URL voor de homepage.", "Inbegrepen"],
                  ["later", "Later aanleveren", "Je vult de link na de bestelling in.", "Inbegrepen"],
                ]
              : [
                  ["write", "Laat ons schrijven", "Jij geeft de link(s), wij schrijven het artikel.", writingFee > 0 ? `+ ${euro(writingFee)}` : "Inbegrepen"],
                  ["self", "Zelf aanleveren", "Eigen tekst of een Google Doc-link.", "Inbegrepen"],
                  ["later", "Later aanleveren", "Je vult dit na de bestelling in.", "Inbegrepen"],
                ]) as [ArticleType, string, string, string][])
              // Bij Bevestigen staat de aanlevervorm op slot: toon alleen de
              // gekozen vorm (wijzigen doe je bij Invullen), zodat je hier niet
              // ongemerkt naar een vorm wisselt die nieuwe inhoud vraagt.
              .filter(([val]) => !lockType || a.type === val)
              .map(([val, title, desc, badge]) => {
              const sel = a.type === val;
              return (
                <button key={val} type="button" disabled={lockType} onClick={() => { if (!lockType) onUpdate(a.id, { type: val }); }} className={`flex flex-col gap-1 rounded-xl border-[1.5px] p-3 text-left transition ${sel ? "border-[var(--btn-pay-bg)] bg-[var(--btn-pay-bg)]/10 shadow-[0_0_0_3px_rgba(47,107,79,0.12)]" : "border-line hover:border-inkSoft/40"} ${lockType ? "cursor-default" : ""}`}>
                  <span className="flex items-center gap-1.5 text-sm font-bold text-ink">{sel && <Check size={15} strokeWidth={2.5} className="text-[var(--btn-pay-bg)]" />}{title}</span>
                  <span className="text-xs text-inkSoft">{desc}</span>
                  <span className={`mt-0.5 text-xs font-semibold ${badge.startsWith("+") ? "text-ink" : "text-[var(--btn-pay-bg)]"}`}>{badge}</span>
                </button>
              );
            })}
          </div>
          {lockType && <p className="mt-2 text-xs text-inkSoft">De aanlevervorm pas je aan bij <span className="font-semibold text-ink">Invullen</span>.</p>}

          {/* Step 2: the content for the chosen manier. */}
          <div className="mt-5">
            {a.type === "" ? (
              <p className="rounded-lg bg-gray-50 px-4 py-6 text-center text-sm text-inkSoft">Kies hierboven hoe je de inhoud aanlevert.</p>
            ) : a.type === "later" ? (
              <p className="rounded-lg bg-[var(--btn-pay-bg)]/10 px-4 py-4 text-sm font-medium text-[var(--btn-pay-bg)]">Je vult de inhoud na de bestelling in onder Mijn orders.</p>
            ) : a.type === "self" ? (
              <TextDelivery a={a} onUpdate={(patch) => onUpdate(a.id, patch)} />
            ) : (
              <LinkDelivery a={a} maxLinks={site.maxLinks} onUpdate={(patch) => onUpdate(a.id, patch)} />
            )}
          </div>

          {(a.type === "write" || a.type === "self") && (
            <div className="mt-6 border-t border-line pt-5">
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-inkSoft">Wanneer live?</label>
              <div className="max-w-[420px]">
                <LiveOp value={a.publishOn} min={schedule.min} max={schedule.max} onChange={(v) => onUpdate(a.id, { publishOn: v })} />
              </div>
            </div>
          )}

          {/* Project — ook hier aanpasbaar, zodat je er niet voor terug hoeft
              naar Invullen. Optioneel, puur voor je eigen overzicht. */}
          <div className="mt-6 border-t border-line pt-5">
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-inkSoft">Project <span className="font-normal normal-case tracking-normal text-inkSoft/60">(optioneel)</span></label>
            <div className="max-w-[420px]">
              <ProjectSelect value={a.projectId} projects={projects} onChange={(id) => onUpdate(a.id, { projectId: id })} onCreated={(p) => { onAddProject(p); onUpdate(a.id, { projectId: p.id }); }} className={pickCls} allowEmpty placeholder="Kies project…" />
            </div>
            <p className="mt-1.5 text-xs text-inkSoft">Groepeer plaatsingen per klant of campagne — alleen voor je eigen overzicht.</p>
          </div>
        </div>
        <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 border-t border-line bg-surface px-4 py-3 sm:px-6">
          {a.type === "" ? (
            <span className="mr-auto text-xs text-inkSoft">Kies hoe je aanlevert om verder te gaan.</span>
          ) : a.type === "self" && !hasSelfContent(a) ? (
            <span className="mr-auto text-xs text-inkSoft">Vul tekst of een Google Doc-link in.</span>
          ) : a.type === "write" && !hasWriteLink(a) ? (
            <span className="mr-auto text-xs text-inkSoft">Vul minstens een ankertekst en doel-URL in.</span>
          ) : null}
          <button type="button" disabled={a.type === "" || (a.type === "self" && !hasSelfContent(a)) || (a.type === "write" && !hasWriteLink(a))} onClick={onClose} className="btn-pay rounded-full px-8 py-2.5 text-sm font-semibold transition disabled:opacity-40">Opslaan</button>
        </div>
      </div>
    </div>
  );
}

// "Live op": a compact chooser. "Op datum" shows the same calendar as the
// regular order form (a floating pop-up that opens straight away), so it never
// bloats the row.
function LiveOp({ value, min, max, onChange }: { value: string; min: string; max: string; onChange: (v: string) => void }) {
  const planned = value !== "";
  // The calendar is shown inline (always visible when "Op datum" is active) so it
  // can't get clipped by the pop-up's scroll area; when you switch to "Op datum"
  // we scroll it into view so you never have to scroll yourself.
  const calRef = useRef<HTMLDivElement>(null);
  const seg = (active: boolean) =>
    `flex-1 whitespace-nowrap rounded-md px-4 py-2 text-sm font-semibold transition-colors ${active ? "bg-surface text-ink shadow-sm" : "text-inkSoft hover:text-ink"}`;
  return (
    <div className="space-y-2.5">
      <div role="radiogroup" aria-label="Wanneer live?" className="flex rounded-lg border border-line bg-gray-50 p-1">
        <button type="button" role="radio" aria-checked={!planned} onClick={() => onChange("")} className={seg(!planned)}>Zo snel mogelijk</button>
        <button type="button" role="radio" aria-checked={planned} onClick={() => { if (!planned) onChange(min); setTimeout(() => calRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }), 30); }} className={seg(planned)}>Op datum</button>
      </div>
      {planned && <div ref={calRef}><DatePicker inline value={value} min={min} max={max} onChange={onChange} /></div>}
    </div>
  );
}

function ReviewStep({ articles, projectById, siteById, writingFee, vatRate, vatNote, sum, loading, canPlace, onRemove, onEdit, onBack, onPlace }: { articles: Article[]; projectById: (id: string) => BulkProject | undefined; siteById: (id: string) => BulkSite; writingFee: number; vatRate: number; vatNote: string | null; sum: number; loading: boolean; canPlace: boolean; onRemove: (id: string) => void; onEdit: (id: string) => void; onBack: () => void; onPlace: () => void }) {
  const price = (a: Article) => { const s = siteById(a.siteId); return s.price + (a.type === "write" && s.kind === "blog" ? writingFee : 0); };
  const btw = sum * (vatRate / 100);
  const total = sum + btw;
  const projectCount = new Set(articles.map((a) => a.projectId).filter(Boolean)).size;
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[1.7fr_1fr]">
      <div>
      {/* Compacte regel-kaarten: per plaatsing wat er geplaatst wordt én wanneer
          het live gaat — bedrag + acties ernaast, zodat je er veel ziet. */}
      <div className="space-y-2">
        {articles.map((a) => {
          const site = siteById(a.siteId);
          const project = projectById(a.projectId);
          const isLater = a.type === "later";
          const isHome = site.kind === "homepage";
          const typeLabel = isLater ? "Inhoud volgt later" : isHome ? "Homepagelink" : "Blogartikel";
          const TypeIcon = isLater ? Clock : isHome ? Link2 : FileText;
          const liveText = isLater ? "Na aanlevering" : a.publishOn ? dayLabel(a.publishOn) : "Zo snel mogelijk";
          // Alleen de informatieve kant tonen: blog + "Laat ons schrijven" = wij
          // schrijven. Zelf aanleveren is de default en krijgt geen badge.
          const weWrite = !isLater && !isHome && a.type === "write";
          return (
            <div key={a.id} className="flex items-start justify-between gap-3 rounded-lg border border-l-4 border-line [border-left-color:var(--btn-pay-bg)] bg-surface px-3.5 py-2.5">
              <div className="min-w-0 flex-1">
                {/* Regel 1: site + soort */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="font-semibold text-ink">{site.domain}</span>
                  <a href={`https://${site.domain}`} target="_blank" rel="noreferrer" className="shrink-0 text-inkSoft/60 hover:text-ink" aria-label={`Open ${site.domain}`}><ExternalLink size={12} /></a>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-[var(--btn-pay-bg)]"><TypeIcon size={12} strokeWidth={2.3} />{typeLabel}</span>
                  {weWrite && <span className="inline-flex items-center rounded-full border border-[#e3d9c2] bg-[#f0ebe0] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--btn-pay-bg)]">Wij schrijven</span>}
                </div>
                {/* Regel 2: inhoud compact (titel · "anker" → url) — niet bij 'volgt later' */}
                {isLater ? (
                  <div className="mt-0.5 text-[13px] text-inkSoft">Je levert de inhoud aan nadat de bestelling is geplaatst.</div>
                ) : (
                  <div className="mt-0.5 space-y-0.5 text-[13px] text-ink">
                    {a.title.trim() && <div><span className="text-inkSoft">Titel:</span> {a.title}</div>}
                    {a.anchor.trim() && (a.secondLink && a.anchor2.trim() ? (
                      <div>
                        <span className="text-inkSoft">Links:</span>
                        <div className="mt-0.5 flex flex-col gap-0.5">
                          <div className="flex flex-wrap items-baseline gap-x-1.5"><span>&ldquo;{a.anchor}&rdquo;</span><span className="text-inkSoft">&rarr;</span><span className="break-all">{a.url}</span></div>
                          <div className="flex flex-wrap items-baseline gap-x-1.5"><span>&ldquo;{a.anchor2}&rdquo;</span><span className="text-inkSoft">&rarr;</span><span className="break-all">{a.url2}</span></div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-baseline gap-x-1.5">
                        <span className="text-inkSoft">Link:</span>
                        <span>&ldquo;{a.anchor}&rdquo;</span><span className="text-inkSoft">&rarr;</span><span className="break-all">{a.url}</span>
                      </div>
                    ))}
                  </div>
                )}
                {/* Regel 3: project + live-moment — live-pil niet bij 'volgt later' */}
                {(project || !isLater) && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {project && <span className="inline-flex min-w-[9.5rem] items-center gap-1.5 rounded-full border bg-gray-50 px-2.5 py-0.5 text-[11px] font-semibold text-[var(--btn-pay-bg)] [border-color:var(--btn-pay-bg)]"><Folder size={11} strokeWidth={2.2} className="shrink-0" /><span className="max-w-[12rem] truncate">{project.name}</span></span>}
                    {!isLater && <span className="inline-flex items-center gap-1 rounded-full border border-line bg-gray-50 px-2.5 py-0.5 text-[11px] font-semibold text-ink"><CalendarDays size={11} className="text-inkSoft" />Live op: {liveText}</span>}
                  </div>
                )}
              </div>
              {/* Bedrag + acties ernaast */}
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <div className="text-right leading-tight">
                  <span className="whitespace-nowrap text-sm font-bold tabular-nums text-ink">{euro(price(a))}</span>
                  {a.type === "write" && site.kind === "blog" && writingFee > 0 && <span className="block text-[10px] font-medium text-inkSoft">incl. {euro(writingFee)} schrijven</span>}
                </div>
                <div className="-mr-1 flex items-center gap-0.5">
                  <button type="button" onClick={() => onEdit(a.id)} className="flex h-7 w-7 items-center justify-center rounded-md text-inkSoft hover:bg-brandSoft hover:text-ink" aria-label="Inhoud aanpassen" title="Inhoud aanpassen"><Pencil size={14} /></button>
                  <button type="button" onClick={() => onRemove(a.id)} className="flex h-7 w-7 items-center justify-center rounded-md text-inkSoft/70 hover:bg-red-50 hover:text-red-600" aria-label="Verwijderen" title="Verwijderen"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
        <div className="mt-3">
          <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-inkSoft transition hover:bg-gray-100 hover:text-ink">&larr; Terug naar invullen</button>
        </div>
      </div>

      {/* Vaste samenvatting rechts: totaal + de bevestig-knop. */}
      <aside className="rounded-2xl border border-line bg-surface p-5 shadow-sm lg:sticky lg:top-4">
        <h2 className="mb-4 font-serif text-lg text-ink">Samenvatting</h2>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-6"><span className="text-inkSoft">Plaatsingen</span><span className="font-semibold tabular-nums text-ink">{articles.length}</span></div>
          {projectCount > 0 && <div className="flex items-center justify-between gap-6"><span className="text-inkSoft">Projecten</span><span className="font-semibold tabular-nums text-ink">{projectCount}</span></div>}
          <div className="flex items-center justify-between gap-6"><span className="text-inkSoft">Subtotaal</span><span className="tabular-nums text-ink">{euro(sum)}</span></div>
          {vatRate > 0 ? (
            <div className="flex items-center justify-between gap-6"><span className="text-inkSoft">Btw ({vatRate}%)</span><span className="tabular-nums text-ink">{euro(btw)}</span></div>
          ) : vatNote ? (
            <div className="text-right text-xs text-inkSoft">{vatNote}</div>
          ) : null}
        </div>
        <div className="mt-3 flex items-baseline justify-between gap-4 border-t border-line pt-3">
          <span className="font-bold text-ink">Totaal</span>
          <span className="font-serif text-2xl font-extrabold tabular-nums text-ink">{euro(total)}</span>
        </div>
        <button type="button" disabled={loading || !canPlace} onClick={onPlace} className="btn-pay mt-4 flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition disabled:opacity-50">{loading ? "Bezig…" : <>Bestelling bevestigen <span aria-hidden>&rarr;</span></>}</button>
        {!canPlace && articles.length > 0 ? (
          <p className="mt-2.5 text-center text-xs font-medium text-amber-700">Eén of meer regels zijn nog niet volledig. Ga terug naar invullen om ze af te maken.</p>
        ) : (
          <p className="mt-2.5 text-center text-xs text-inkSoft">Op rekening · geen betaling nu</p>
        )}
      </aside>
    </div>
  );
}

function DoneStep({ articleCount, orderCount, sum }: { articleCount: number; orderCount: number; sum: number }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-6 py-10 text-center">
      <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"><Check size={32} strokeWidth={2.5} /></span>
      <h2 className="font-serif text-2xl text-ink">Bestelling geplaatst</h2>
      <p className="mt-1.5 text-inkSoft">{articleCount} {articleCount === 1 ? "plaatsing" : "plaatsingen"} in {orderCount} {orderCount === 1 ? "order" : "orders"} · {euro(sum)}</p>
      <p className="mx-auto mt-3 max-w-md rounded-lg border border-[#ecdfbc] bg-[#fbf7ec] px-4 py-2 text-sm text-[#8a5a12]">Komt op je verzamelfactuur. Plaatsingen met <span className="font-semibold">Later aanleveren</span> (of nog zonder content) vul je per stuk aan onder Mijn orders.</p>
      <Link href="/dashboard/orders" className="btn-pay mt-6 inline-block rounded-full px-5 py-2.5 text-sm font-semibold transition">Naar mijn orders →</Link>
    </div>
  );
}
