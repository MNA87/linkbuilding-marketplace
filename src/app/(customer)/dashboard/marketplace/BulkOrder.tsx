"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarDays, Check, ChevronDown, ExternalLink, GripVertical, Lock, Minus, Pencil, Plus, SlidersHorizontal, Trash2, X } from "lucide-react";
import CountryFlag from "@/components/CountryFlag";
import RichTextEditor from "@/components/RichTextEditor";
import PhotoPicker from "@/components/PhotoPicker";
import DatePicker from "@/components/DatePicker";
import { durationKindLabel } from "@/lib/placementPeriod";
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
  rd: "Verw. domeinen",
  maxlinks: "Max. links",
  gesponsord: "Gesponsord",
  duur: "Looptijd",
  voorbeeld: "Voorbeeld",
};
const COL_RIGHT = new Set<ColumnKey>(["dr", "da", "verkeer", "tfcf", "rd", "maxlinks"]);
const COLS_KEY = "nugevonden-bulk-columns-v2";

const euro = (n: number) => `€ ${n.toLocaleString("nl-NL")}`;
const nl = (n: number | null) => (n === null ? "–" : n.toLocaleString("nl-NL"));
const dayLabel = (d: string) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("nl-NL", { day: "numeric", month: "short" }) : "zo snel mogelijk");

// A "Zelf aanleveren" article counts as delivered only when there's real text
// (an empty editor still holds "<p></p>", which should NOT count) or a Google
// Doc link — so you can't "opslaan" an empty article.
function hasSelfContent(a: Article): boolean {
  return a.docUrl.trim().length > 0 || a.body.replace(/<[^>]*>/g, "").trim().length > 0;
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
function looksLikeSite(url: string): boolean {
  return /[^.\s]\.[^.\s]/.test(url.trim());
}
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
const doneBtnCls = "inline-flex w-[195px] items-center justify-start gap-2 whitespace-nowrap rounded-lg border-[1.5px] border-solid border-[var(--btn-pay-bg)]/35 bg-[var(--btn-pay-bg)]/10 px-3 py-2 text-sm font-bold text-[var(--btn-pay-bg)] transition hover:bg-[var(--btn-pay-bg)]/15";
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

export default function BulkOrder({ sites, projects: initialProjects, schedule, topics, topicId, writingFee, initialCart }: { sites: BulkSite[]; projects: BulkProject[]; schedule: { min: string; max: string }; topics: { id: string; name: string }[]; topicId: string; writingFee: number; initialCart: BulkCartItem[] }) {
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
  // "Resumed" = you arrived with an order already in progress (saved earlier /
  // came in via the cart), captured once at mount so a fresh in-session build
  // doesn't count even after the cart refreshes.
  const [hadInitialOrder] = useState(() => initialCart.length > 0);
  // Once you've opened "Invullen", the resume-melding has done its job — hide it
  // for the rest of the session, so going back to "Kiezen" (via Sites toevoegen)
  // doesn't show "je hebt een bestelling in bewerking" again.
  const [resumeDismissed, setResumeDismissed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ orderCount: number; articleCount: number } | null>(null);
  const [columns, setColumns] = useState<ColumnPrefs>(DEFAULT_COLUMNS);

  useEffect(() => {
    if (step === "fill") setResumeDismissed(true);
  }, [step]);

  // Remember the current step across a page refresh, so going back to "Kiezen"
  // and refreshing keeps you on "Kiezen" instead of jumping to "Invullen".
  // On a fresh first load (nothing remembered) we still resume a saved draft.
  // The resume-melding stays dismissed across a refresh too, so returning to
  // "Kiezen" and refreshing never pops it back up.
  useEffect(() => {
    try {
      if (sessionStorage.getItem("bulkResumeDismissed") === "1") setResumeDismissed(true);
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
      if (step === "done") { sessionStorage.removeItem("bulkStep"); sessionStorage.removeItem("bulkResumeDismissed"); }
      else sessionStorage.setItem("bulkStep", step);
    } catch { /* storage unavailable */ }
  }, [step]);
  useEffect(() => {
    try {
      if (resumeDismissed) sessionStorage.setItem("bulkResumeDismissed", "1");
    } catch { /* storage unavailable */ }
  }, [resumeDismissed]);
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
  // Per-row price including the "Laat ons schrijven" writing fee (€25, or 0 when
  // writing is in this customer's price). The type is only known from "Invullen"
  // on, so on "Kiezen" every row is still just the placement price.
  const rowPrice = (a: Article) => { const s = siteById(a.siteId); return s.price + (a.type === "write" && s.kind === "blog" ? writingFee : 0); };
  const selectedSum = articles.reduce((n, a) => n + rowPrice(a), 0);
  // How many selected rows still need content — so the footer button can say
  // "Nog X invullen" instead of blindly "N artikelen invullen".
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
  const setAllType = (type: ArticleType) => setArticles((list) => list.map((a) => (siteById(a.siteId).kind === "homepage" ? a : { ...a, type })));

  const articlesSum = articles.reduce((n, a) => n + rowPrice(a), 0);
  const usedProjectIds = Array.from(new Set(articles.map((a) => a.projectId)));

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
    <div className="max-w-5xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-serif text-2xl text-ink">Marketplace</h1>
        <span className="rounded-full border border-[#e3d9c2] bg-[#f0ebe0] px-3 py-1 text-xs font-semibold text-[#3f3a2f]">
          Op rekening · verzamelfactuur
        </span>
      </div>

      <Stepper step={step} onJump={step === "done" ? undefined : jumpTo} />

      {error && step !== "done" && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
      )}

      {/* Resuming a half-finished order — pick it up where you left off. Shown
          when you arrived with an order in progress, or came back from
          "Invullen"; not while building your first selection in step 1. */}
      {step === "select" && articles.length > 0 && hadInitialOrder && !resumeDismissed && (
        <div className="mb-4 flex flex-col gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-emerald-900">
            <span className="font-semibold">Je hebt een bestelling in bewerking</span> — {selectedArticles} {selectedArticles === 1 ? "artikel" : "artikelen"} ·{" "}
            {euro(selectedSum)}. <span className="text-emerald-700/90">Je concept is bewaard.</span>
          </div>
          <button type="button" onClick={() => setStep("fill")} className="btn-pay shrink-0 rounded-full px-4 py-2 text-sm font-semibold">Verder invullen &rarr;</button>
        </div>
      )}

      {step === "select" && (
        <SelectStep sites={sites} qty={qty} pending={pending} onAdd={addSite} onRemove={removeSite} columns={columns} onColumns={updateColumns} topics={topics} topicId={topicId} onTopic={onTopic} selectedArticles={selectedArticles} selectedSum={selectedSum} remainingToFill={remainingToFill} onNext={goToFill} />
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
          onNext={() => setStep("review")}
        />
      )}

      {step === "review" && (
        <ReviewStep
          articles={articles}
          usedProjectIds={usedProjectIds}
          projectById={projectById}
          siteById={siteById}
          writingFee={writingFee}
          sum={articlesSum}
          loading={loading}
          onRemove={removeArticle}
          canPlace={articles.length > 0}
          onBack={() => setStep("fill")}
          onPlace={place}
        />
      )}

      {step === "done" && result && <DoneStep articleCount={result.articleCount} orderCount={result.orderCount} sum={articlesSum} />}
    </div>
  );
}

function Stepper({ step, onJump }: { step: string; onJump?: (key: string) => void }) {
  const steps = [
    { key: "select", label: "Kiezen" },
    { key: "fill", label: "Invullen" },
    { key: "review", label: "Bevestigen" },
  ];
  const order = ["select", "fill", "review", "done"];
  const current = order.indexOf(step);
  return (
    <ol className="mb-6 flex items-center">
      {steps.map((s, i) => {
        const idx = order.indexOf(s.key);
        const done = idx < current;
        const active = idx === current;
        // Done steps are clickable, so you can hop back (e.g. to "Kiezen") without
        // losing anything you already filled in.
        const clickable = done && !!onJump;
        const inner = (
          <>
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${done ? "bg-[var(--btn-pay-bg)] text-white" : active ? "border-2 border-[var(--btn-pay-bg)] bg-white text-[var(--btn-pay-bg)]" : "bg-gray-200 text-inkSoft"}`}>
              {done ? <Check size={15} strokeWidth={3} /> : i + 1}
            </span>
            <span className={`text-sm font-semibold ${done || active ? "text-ink" : "text-inkSoft/70"}`}>{s.label}</span>
          </>
        );
        return (
          <li key={s.key} className={`flex items-center ${i < steps.length - 1 ? "flex-1" : ""}`}>
            {clickable ? (
              <button type="button" onClick={() => onJump!(s.key)} className="flex items-center gap-2 rounded-md hover:opacity-80" title={`Terug naar ${s.label}`}>{inner}</button>
            ) : (
              <span className="flex items-center gap-2">{inner}</span>
            )}
            {i < steps.length - 1 && <span className={`mx-3 h-0.5 flex-1 rounded ${done ? "bg-[var(--btn-pay-bg)]" : "bg-line"}`} />}
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

function SelectStep({ sites, qty, pending, onAdd, onRemove, columns, onColumns, topics, topicId, onTopic, selectedArticles, selectedSum, remainingToFill, onNext }: { sites: BulkSite[]; qty: Record<string, number>; pending: Set<string>; onAdd: (id: string) => void; onRemove: (id: string) => void; columns: ColumnPrefs; onColumns: (p: ColumnPrefs) => void; topics: { id: string; name: string }[]; topicId: string; onTopic: (id: string) => void; selectedArticles: number; selectedSum: number; remainingToFill: number; onNext: () => void }) {
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
  const nicheOptions = uniqSorted(sites.flatMap((s) => s.niches));
  const landOptions = uniqSorted(sites.map((s) => s.country));
  const taalOptions = uniqSorted(sites.map((s) => s.language));
  const q = search.trim().toLowerCase();
  const atLeast = (value: number | null, v: string) => v === "" || (value ?? -1) >= Number(v);
  const filtered = sites.filter(
    (s) =>
      s.kind === linkType &&
      (!q || s.domain.toLowerCase().includes(q) || s.niches.some((n) => n.toLowerCase().includes(q))) &&
      (!niche || s.niches.includes(niche)) &&
      (!land || s.country === land) &&
      (!taal || s.language === taal) &&
      atLeast(s.dr, minDr) &&
      atLeast(s.da, minDa) &&
      atLeast(s.traffic, minTraffic) &&
      atLeast(s.maxLinks, minLinks) &&
      (!sponsored || s.sponsored === (sponsored === "ja")) &&
      (!duur || s.periodic === (duur === "jaar")) &&
      (maxPrice === "" || s.price <= Number(maxPrice))
  );
  const hasFilter = [search, niche, land, taal, minDr, minDa, minTraffic, minLinks, sponsored, duur, maxPrice].some((v) => v !== "");
  const resetFilters = () => { setSearch(""); setNiche(""); setLand(""); setTaal(""); setMinDr(""); setMinDa(""); setMinTraffic(""); setMinLinks(""); setSponsored(""); setDuur(""); setMaxPrice(""); };
  const filterField = "rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand";
  // Compact inputs used in the inline filter row (desktop) and the mobile sheet.
  const ff = "w-full min-w-0 rounded-md border border-line bg-white px-2 py-1.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-brand";
  const numFilter = (val: string, set: (v: string) => void, placeholder = "≥") => (
    <input type="number" inputMode="numeric" min={0} value={val} onChange={(e) => set(e.target.value)} placeholder={placeholder} aria-label={placeholder === "≥" ? "vanaf" : "maximaal"} className={`${ff} text-right md:w-[76px] ${val ? "border-brand font-semibold" : ""}`} />
  );
  const selFilter = (val: string, set: (v: string) => void, label: string, options: { value: string; name: string }[]) => (
    <select value={val} onChange={(e) => set(e.target.value)} aria-label={label} className={`${ff} ${val ? "border-brand font-semibold" : "text-inkSoft"}`}>
      <option value="">Alle</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.name}</option>)}
    </select>
  );
  const colFilter = (key: ColumnKey): ReactNode => {
    switch (key) {
      case "niche": return selFilter(niche, setNiche, "Niche", nicheOptions.map((n) => ({ value: n, name: n })));
      case "land": return selFilter(land, setLand, "Land", landOptions.map((n) => ({ value: n, name: n })));
      case "taal": return selFilter(taal, setTaal, "Taal", taalOptions.map((n) => ({ value: n, name: n })));
      case "dr": return numFilter(minDr, setMinDr);
      case "da": return numFilter(minDa, setMinDa);
      case "verkeer": return numFilter(minTraffic, setMinTraffic);
      case "maxlinks": return numFilter(minLinks, setMinLinks);
      case "gesponsord": return selFilter(sponsored, setSponsored, "Gesponsord", [{ value: "ja", name: "Ja" }, { value: "nee", name: "Nee" }]);
      case "duur": return selFilter(duur, setDuur, "Looptijd", [{ value: "permanent", name: "Permanent" }, { value: "jaar", name: "Per jaar" }]);
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
              <button key={val} type="button" role="radio" aria-checked={linkType === val} onClick={() => setLinkType(val)} className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${linkType === val ? "bg-surface text-ink shadow-sm" : "text-inkSoft hover:text-ink"}`}>{label}</button>
            ))}
          </div>
        )}
        {topics.length > 0 && (
          <label className={`relative inline-flex items-center gap-1.5 rounded-lg border bg-surface px-3 py-2 text-sm ${topicId ? "border-brand" : "border-line"}`}>
            <span className="text-inkSoft">Prijzen voor:</span>
            <span className="font-semibold text-ink">{topics.find((t) => t.id === topicId)?.name ?? "Algemeen"}</span>
            <ChevronDown size={14} className="text-inkSoft" />
            <select value={topicId} onChange={(e) => onTopic(e.target.value)} aria-label="Prijzen voor onderwerp" className="absolute inset-0 cursor-pointer opacity-0">
              <option value="">Algemeen</option>
              {topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            {topicId && (
              <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onTopic(""); }} aria-label="Prijs-onderwerp wissen" className="relative z-20 -mr-1 ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-inkSoft hover:bg-gray-100 hover:text-ink"><X size={11} /></button>
            )}
          </label>
        )}
        <button type="button" onClick={() => setFiltersOpen((o) => !o)} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm md:hidden ${hasFilter ? "border-brand font-semibold text-brand" : "border-line text-ink"}`}>
          <SlidersHorizontal size={15} /> Filters{hasFilter ? ` · ${[niche, land, taal, minDr, minDa, minTraffic, minLinks, sponsored, duur, maxPrice].filter(Boolean).length}` : ""}
        </button>
        {hasFilter && (
          <button type="button" onClick={resetFilters} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-inkSoft hover:bg-gray-50 hover:text-ink"><X size={14} /> Filters wissen</button>
        )}
        <div className="relative ml-auto hidden md:block">
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
        <div className="mb-3 grid grid-cols-2 gap-2 rounded-xl border border-line bg-surface p-3 md:hidden">
          <label className="text-xs text-inkSoft">Niche{selFilter(niche, setNiche, "Niche", nicheOptions.map((n) => ({ value: n, name: n })))}</label>
          <label className="text-xs text-inkSoft">Land{selFilter(land, setLand, "Land", landOptions.map((n) => ({ value: n, name: n })))}</label>
          <label className="text-xs text-inkSoft">Taal{selFilter(taal, setTaal, "Taal", taalOptions.map((n) => ({ value: n, name: n })))}</label>
          <label className="text-xs text-inkSoft">Gesponsord{selFilter(sponsored, setSponsored, "Gesponsord", [{ value: "ja", name: "Ja" }, { value: "nee", name: "Nee" }])}</label>
          <label className="text-xs text-inkSoft">DR vanaf{numFilter(minDr, setMinDr)}</label>
          <label className="text-xs text-inkSoft">DA vanaf{numFilter(minDa, setMinDa)}</label>
          <label className="text-xs text-inkSoft">Verkeer vanaf{numFilter(minTraffic, setMinTraffic)}</label>
          <label className="text-xs text-inkSoft">Max. links vanaf{numFilter(minLinks, setMinLinks)}</label>
          <label className="text-xs text-inkSoft">Looptijd{selFilter(duur, setDuur, "Looptijd", [{ value: "permanent", name: "Permanent" }, { value: "jaar", name: "Per jaar" }])}</label>
          <label className="text-xs text-inkSoft">Max. prijs{numFilter(maxPrice, setMaxPrice, "≤")}</label>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="mb-3 rounded-xl border border-line bg-surface p-6 text-center text-sm text-inkSoft">
          Geen sites gevonden met deze filters. <button type="button" onClick={resetFilters} className="font-semibold text-brand hover:underline">Wis filters</button>
        </div>
      )}
      <div className="hidden overflow-x-auto rounded-xl border border-line bg-surface md:block">
        <table className="w-max">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-semibold text-inkSoft">
              <th className="sticky left-0 z-20 w-[132px] bg-gray-50 px-4 py-3 whitespace-nowrap">Aantal</th>
              <th className="sticky left-[132px] z-20 w-[190px] bg-gray-50 px-4 py-3 whitespace-nowrap">Site</th>
              <th className="sticky left-[322px] z-20 w-[104px] bg-gray-50 border-r border-line px-4 py-3 text-left whitespace-nowrap">Prijs</th>
              {shown.map((k) => <th key={k} className={`px-4 py-3 whitespace-nowrap ${COL_RIGHT.has(k) ? "text-right" : ""}`}>{COL_LABEL[k]}</th>)}
            </tr>
            <tr className="bg-gray-50 text-left text-xs font-semibold text-inkSoft">
              <th className="sticky left-0 z-20 w-[132px] bg-gray-50 px-3 py-1.5"></th>
              <th className="sticky left-[132px] z-20 w-[190px] bg-gray-50 px-3 py-1.5"></th>
              <th className="sticky left-[322px] z-20 w-[104px] bg-gray-50 border-r border-line px-2 py-1.5 align-top">{numFilter(maxPrice, setMaxPrice, "≤")}</th>
              {shown.map((k) => <th key={k} className="px-3 py-1.5 align-top">{colFilter(k)}</th>)}
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
                  <tr onClick={() => toggleDetails(s.id)} aria-expanded={open} className={`group cursor-pointer border-t border-line text-sm ${n > 0 ? "bg-emerald-50/40" : ""}`}>
                    <td className={`sticky left-0 z-10 w-[132px] px-4 py-3 ${n > 0 ? "bg-emerald-50" : "bg-surface"}`} onClick={(e) => e.stopPropagation()}>
                      <div className={`inline-flex items-center overflow-hidden rounded-lg border ${n > 0 ? "border-[var(--btn-pay-bg)]" : "border-line"}`}>
                        <button type="button" disabled={n === 0 || pending.has(s.id)} onClick={() => onRemove(s.id)} className="flex h-8 w-8 items-center justify-center text-inkSoft hover:bg-gray-50 disabled:opacity-30"><Minus size={14} /></button>
                        <span className={`w-8 text-center text-sm font-bold tabular-nums ${n > 0 ? "text-[var(--btn-pay-bg)]" : "text-inkSoft/50"}`}>{n}</span>
                        <button type="button" disabled={pending.has(s.id)} onClick={() => onAdd(s.id)} className="flex h-8 w-8 items-center justify-center text-inkSoft hover:bg-gray-50 disabled:opacity-30"><Plus size={14} /></button>
                      </div>
                    </td>
                    <td className={`sticky left-[132px] z-10 w-[190px] px-4 py-3 ${n > 0 ? "bg-emerald-50" : "bg-surface"}`}>
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate font-semibold text-ink">{s.domain}</span>
                        <a onClick={(e) => e.stopPropagation()} href={`https://${s.domain}`} target="_blank" rel="noreferrer" className="shrink-0 text-inkSoft/60 hover:text-ink" aria-label={`Open ${s.domain}`}><ExternalLink size={13} /></a>
                      </div>
                    </td>
                    <td className={`sticky left-[322px] z-10 w-[104px] border-r border-line px-4 py-3 text-left ${n > 0 ? "bg-emerald-50" : "bg-surface"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="whitespace-nowrap font-semibold tabular-nums text-ink">{euro(s.price)}</span>
                        <ChevronDown size={16} className={`shrink-0 text-inkSoft/50 transition-transform ${open ? "rotate-180" : ""}`} />
                      </div>
                    </td>
                    {shown.map((k) => <td key={k} className={`px-4 py-3 whitespace-nowrap group-hover:bg-gray-50/60 ${COL_RIGHT.has(k) ? "text-right" : ""}`}>{bulkCell(s, k)}</td>)}
                  </tr>
                  {open && (
                    <tr>
                      <td colSpan={shown.length + 3} className="border-t border-line bg-brandSoft/20 p-0">
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

      <div className="mt-4 flex flex-col items-stretch gap-3 rounded-xl border border-[#e3d9c2] bg-[#f0ebe0] px-5 py-4 text-[#3f3a2f] sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm">
          <span className="font-extrabold">{selectedArticles} {selectedArticles === 1 ? "artikel" : "artikelen"}</span>
          {selectedArticles > 0 && remainingToFill < selectedArticles && (
            <span> · {selectedArticles - remainingToFill} klaar</span>
          )}
          {selectedArticles > 0 && <span> · samen {euro(selectedSum)}</span>}
        </div>
        <button type="button" disabled={selectedArticles === 0} onClick={onNext} className="btn-pay rounded-full px-5 py-2.5 text-sm font-semibold transition disabled:opacity-40">
          {remainingToFill === 0
            ? <>Alles ingevuld · nakijken &rarr;</>
            : remainingToFill < selectedArticles
              ? <>Nog {remainingToFill} invullen &rarr;</>
              : <>{selectedArticles} {selectedArticles === 1 ? "artikel" : "artikelen"} invullen &rarr;</>}
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

function FillStep({ articles, projects, schedule, siteById, onUpdate, onRemove, onAddSites, onSetAllProject, onSetAllType, onAddProject, writingFee, sum, onNext }: { articles: Article[]; projects: BulkProject[]; schedule: { min: string; max: string }; siteById: (id: string) => BulkSite; onUpdate: (id: string, patch: Partial<Article>) => void; onRemove: (id: string) => void; onAddSites: () => void; onSetAllProject: (projectId: string) => void; onSetAllType: (type: ArticleType) => void; onAddProject: (p: BulkProject) => void; writingFee: number; sum: number; onNext: () => void }) {
  const projectCount = new Set(articles.filter((a) => a.projectId).map((a) => a.projectId)).size;
  const missingType = articles.filter((a) => !a.type).length;
  // "Laat ons schrijven" needs the link(s) we write around: anchor + doel-URL.
  const incompleteWrite = articles.filter((a) => a.type === "write" && !hasWriteLink(a)).length;
  const blocked = articles.length === 0 || missingType > 0 || incompleteWrite > 0;
  // Which article's text is being typed in the pop-up editor (so the table
  // stays a clean flat overview and the full editor opens in a focused window).
  const [editing, setEditing] = useState<string | null>(null);
  const editArticle = editing ? articles.find((a) => a.id === editing) ?? null : null;
  // What the project picker shows — so a chosen project stays visible instead of
  // snapping back to the placeholder.
  const [quickProject, setQuickProject] = useState("");
  const quickSel = "w-full rounded-md border border-line bg-surface px-2.5 py-2 text-sm font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-[var(--btn-pay-bg)]/30";
  const quickLbl = "mb-1 block text-[10px] font-bold uppercase tracking-wide text-inkSoft";
  // Regels die nog actie nodig hebben (geel) zoveel mogelijk bovenaan; ingevulde
  // regels zakken eronder. Stabiele sort, dus binnen elke groep blijft de
  // oorspronkelijke volgorde behouden.
  const orderedArticles = [...articles].sort((a, b) => (rowStatus(a) === "todo" ? 0 : 1) - (rowStatus(b) === "todo" ? 0 : 1));
  // One button per row in the "Inhoud" column. No "manier" chosen yet → one
  // yellow "Actie nodig" button that opens the popup (where you first pick how
  // you deliver); once chosen it becomes "+ toevoegen" / the green done-button.
  const inhoudCell = (a: Article, full: boolean) => {
    const doneCls = full ? `${doneBtnCls} flex-1` : doneBtnCls;
    const addCls = full ? `${addBtnCls} w-full` : addBtnCls;
    const actCls = full ? `${actionBtnCls} w-full` : actionBtnCls;
    const pencil = (
      <button type="button" onClick={() => setEditing(a.id)} className={`flex ${full ? "h-10 w-10" : "h-9 w-9"} shrink-0 items-center justify-center rounded-lg border border-line text-inkSoft hover:bg-brandSoft hover:text-ink`} aria-label="Bewerken"><Pencil size={15} /></button>
    );
    // Homepage link: alleen een link (ankertekst + doel-URL) of "Later aanleveren".
    if (siteById(a.siteId).kind === "homepage") {
      if (a.type === "later") return <div className="flex items-center gap-2"><button type="button" onClick={() => setEditing(a.id)} className={doneCls}><Check size={16} strokeWidth={2.5} /> Volgt later</button>{pencil}</div>;
      if (hasWriteLink(a)) return <div className="flex items-center gap-2"><button type="button" onClick={() => setEditing(a.id)} className={doneCls}><Check size={16} strokeWidth={2.5} /> Link toegevoegd</button>{pencil}</div>;
      return <button type="button" onClick={() => setEditing(a.id)} className={actCls}><AlertTriangle size={16} /> Link toevoegen</button>;
    }
    if (!a.type) return <button type="button" onClick={() => setEditing(a.id)} className={actCls}><AlertTriangle size={16} /> Inhoud toevoegen</button>;
    if (a.type === "later") return <button type="button" onClick={() => setEditing(a.id)} className={doneCls}><Check size={16} strokeWidth={2.5} /> Volgt later</button>;
    if (a.type === "self")
      return hasSelfContent(a) ? (
        <div className="flex items-center gap-2"><button type="button" onClick={() => setEditing(a.id)} className={doneCls}><Check size={16} strokeWidth={2.5} /> Artikel toegevoegd</button>{pencil}</div>
      ) : (
        <button type="button" onClick={() => setEditing(a.id)} className={addCls}><Plus size={16} /> Artikel toevoegen</button>
      );
    return hasWriteLink(a) ? (
      <div className="flex items-center gap-2"><button type="button" onClick={() => setEditing(a.id)} className={doneCls}><Check size={16} strokeWidth={2.5} /> {hasSecondWriteLink(a) ? "Links toegevoegd" : "Link toegevoegd"}</button>{pencil}</div>
    ) : (
      <button type="button" onClick={() => setEditing(a.id)} className={addCls}><Plus size={16} /> Link toevoegen</button>
    );
  };
  return (
    <>
      <p className="mb-3 text-sm text-inkSoft">Stel hieronder de standaard voor alle regels in — pas per regel aan waar nodig. Regels die nog iets nodig hebben, krijgen een geel streepje.</p>

      {(
        <div className="mb-3 rounded-xl border border-line bg-gray-50 p-3">
          <div className="mb-2.5 flex items-center gap-1.5 text-sm font-semibold text-ink">⚡ Snel invullen — op alle regels</div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className={quickLbl}>Manier van aanleveren</label>
              <select onChange={(e) => e.target.value && onSetAllType(e.target.value as ArticleType)} defaultValue="" className={quickSel}>
                <option value="" disabled>Kies…</option>
                <option value="write">Laat ons schrijven</option>
                <option value="self">Zelf aanleveren</option>
                <option value="later">Later aanleveren</option>
              </select>
            </div>
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
          </div>
        </div>
      )}

      <div className="hidden overflow-x-auto rounded-xl border border-line bg-surface md:block">
        <table className="w-full min-w-[880px]">
          <thead>
            <tr className="bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wide text-inkSoft">
              <th className="px-3 py-2.5">Website</th>
              <th className="px-3 py-2.5">Inhoud</th>
              <th className="px-3 py-2.5">Project</th>
              <th className="px-3 py-2.5 text-right">Prijs</th>
              <th className="px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {orderedArticles.map((a, i) => {
              const site = siteById(a.siteId);
              return (
                <tr key={a.id} className="border-t border-line align-top text-sm">
                  <td className={`whitespace-nowrap border-l-4 px-3 py-3 ${STATUS_EDGE[rowStatus(a)]}`}>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold tabular-nums text-inkSoft/60">{i + 1}.</span>
                      <span className="font-semibold text-ink">{site.domain}</span>
                      <a href={`https://${site.domain}`} target="_blank" rel="noreferrer" className="text-inkSoft/60 hover:text-ink" aria-label={`Open ${site.domain}`}><ExternalLink size={12} /></a>
                    </div>
                  </td>
                  <td className="w-[270px] min-w-[270px] px-3 py-3 align-top">
                    {inhoudCell(a, false)}
                  </td>
                  <td className="w-[210px] min-w-[210px] px-3 py-3 align-top">
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
                    <span className="text-base font-extrabold tabular-nums text-ink">{euro(site.price + (a.type === "write" && site.kind === "blog" ? writingFee : 0))}</span>
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
      <div className="space-y-3 md:hidden">
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
                    <span className="text-base font-extrabold tabular-nums text-ink">{euro(site.price + (a.type === "write" && site.kind === "blog" ? writingFee : 0))}</span>
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
              </div>
            </div>
          );
        })}
      </div>


      <div className="mt-4 flex flex-col items-stretch gap-3 rounded-xl border border-[#e3d9c2] bg-[#f0ebe0] px-5 py-4 text-[#3f3a2f] sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm">
          <span className="font-extrabold">{articles.length} artikelen</span> · {projectCount} {projectCount === 1 ? "project" : "projecten"} · samen {euro(sum)} · op rekening
          <div className="mt-1 flex items-center gap-1 text-xs text-[#6b6450]"><Check size={13} /> Je concept wordt automatisch bewaard — stop gerust en ga later verder.</div>
          {missingType > 0 && (
            <div className="mt-1 text-xs font-semibold text-amber-700">Kies nog hoe je aanlevert bij {missingType} {missingType === 1 ? "regel" : "regels"}.</div>
          )}
          {incompleteWrite > 0 && (
            <div className="mt-1 text-xs font-semibold text-amber-700">Vul ankertekst en doel-URL in bij {incompleteWrite} {incompleteWrite === 1 ? "regel" : "regels"} met &ldquo;Laat ons schrijven&rdquo;.</div>
          )}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onAddSites} className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-[var(--btn-pay-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--btn-pay-bg)] hover:bg-brandSoft/40"><Plus size={16} /> Sites toevoegen</button>
          <button type="button" disabled={blocked} onClick={onNext} className="btn-pay rounded-full px-5 py-2.5 text-sm font-semibold transition disabled:opacity-40">Naar bevestigen &rarr;</button>
        </div>
      </div>

      {/* Zelf aanleveren — op mobiel schermvullend (edge-to-edge), op desktop
          een nette gecentreerde dialog met achtergrond. */}
      {editArticle && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-surface sm:flex sm:items-center sm:justify-center sm:overflow-visible sm:bg-black/40 sm:p-6"
          onPointerDown={(e) => { if (e.target === e.currentTarget) setEditing(null); }}
        >
          <div className="flex min-h-full flex-col bg-surface sm:min-h-0 sm:max-h-[85vh] sm:w-full sm:max-w-3xl sm:rounded-2xl sm:border sm:border-line sm:shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-4 py-3 sm:px-6">
              <h3 className="font-serif text-lg text-ink">{siteById(editArticle.siteId).kind === "homepage" ? "Homepage link" : "Inhoud"} voor {siteById(editArticle.siteId).domain}</h3>
              <button type="button" onClick={() => setEditing(null)} className="text-inkSoft hover:text-ink" aria-label="Sluiten"><X size={20} /></button>
            </div>
            <div className="px-4 py-5 sm:flex-1 sm:overflow-y-auto sm:px-6">
              {/* Step 1: how do you deliver? Homepage links are just a link (or
                  later); blog links have the write/self/later choice. */}
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-inkSoft">Hoe lever je aan?</label>
              <div className={`grid gap-2 ${siteById(editArticle.siteId).kind === "homepage" ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
                {((siteById(editArticle.siteId).kind === "homepage"
                  ? [
                      ["write", "Link invullen", "Ankertekst + doel-URL voor de homepage.", "Inbegrepen"],
                      ["later", "Later aanleveren", "Je vult de link na de bestelling in.", "Inbegrepen"],
                    ]
                  : [
                      ["write", "Laat ons schrijven", "Jij geeft de link(s), wij schrijven het artikel.", writingFee > 0 ? `+ ${euro(writingFee)}` : "Inbegrepen"],
                      ["self", "Zelf aanleveren", "Eigen tekst of een Google Doc-link.", "Inbegrepen"],
                      ["later", "Later aanleveren", "Je vult dit na de bestelling in.", "Inbegrepen"],
                    ]) as [ArticleType, string, string, string][]).map(([val, title, desc, badge]) => {
                  const sel = editArticle.type === val;
                  return (
                    <button key={val} type="button" onClick={() => onUpdate(editArticle.id, { type: val })} className={`flex flex-col gap-1 rounded-xl border-[1.5px] p-3 text-left transition ${sel ? "border-[var(--btn-pay-bg)] bg-[var(--btn-pay-bg)]/10 shadow-[0_0_0_3px_rgba(47,107,79,0.12)]" : "border-line hover:border-inkSoft/40"}`}>
                      <span className="flex items-center gap-1.5 text-sm font-bold text-ink">{sel && <Check size={15} strokeWidth={2.5} className="text-[var(--btn-pay-bg)]" />}{title}</span>
                      <span className="text-xs text-inkSoft">{desc}</span>
                      <span className={`mt-0.5 text-xs font-semibold ${badge.startsWith("+") ? "text-ink" : "text-[var(--btn-pay-bg)]"}`}>{badge}</span>
                    </button>
                  );
                })}
              </div>

              {/* Step 2: the content for the chosen manier. */}
              <div className="mt-5">
                {editArticle.type === "" ? (
                  <p className="rounded-lg bg-gray-50 px-4 py-6 text-center text-sm text-inkSoft">Kies hierboven hoe je de inhoud aanlevert.</p>
                ) : editArticle.type === "later" ? (
                  <p className="rounded-lg bg-[var(--btn-pay-bg)]/10 px-4 py-4 text-sm font-medium text-[var(--btn-pay-bg)]">Je vult de inhoud na de bestelling in onder Mijn orders.</p>
                ) : editArticle.type === "self" ? (
                  <TextDelivery a={editArticle} onUpdate={(patch) => onUpdate(editArticle.id, patch)} />
                ) : (
                  <LinkDelivery a={editArticle} maxLinks={siteById(editArticle.siteId).maxLinks} onUpdate={(patch) => onUpdate(editArticle.id, patch)} />
                )}
              </div>

              {(editArticle.type === "write" || editArticle.type === "self") && (
                <div className="mt-6 border-t border-line pt-5">
                  <label className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-inkSoft">Wanneer live?</label>
                  <div className="max-w-[420px]">
                    <LiveOp value={editArticle.publishOn} min={schedule.min} max={schedule.max} onChange={(v) => onUpdate(editArticle.id, { publishOn: v })} />
                  </div>
                </div>
              )}
            </div>
            <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 border-t border-line bg-surface px-4 py-3 sm:px-6">
              {editArticle.type === "" ? (
                <span className="mr-auto text-xs text-inkSoft">Kies hoe je aanlevert om verder te gaan.</span>
              ) : editArticle.type === "self" && !hasSelfContent(editArticle) ? (
                <span className="mr-auto text-xs text-inkSoft">Vul tekst of een Google Doc-link in.</span>
              ) : editArticle.type === "write" && !hasWriteLink(editArticle) ? (
                <span className="mr-auto text-xs text-inkSoft">Vul minstens een ankertekst en doel-URL in.</span>
              ) : null}
              <button type="button" disabled={editArticle.type === "" || (editArticle.type === "self" && !hasSelfContent(editArticle)) || (editArticle.type === "write" && !hasWriteLink(editArticle))} onClick={() => setEditing(null)} className="btn-pay rounded-full px-8 py-2.5 text-sm font-semibold transition disabled:opacity-40">Opslaan</button>
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

function ReviewStep({ articles, usedProjectIds, projectById, siteById, writingFee, sum, loading, canPlace, onRemove, onBack, onPlace }: { articles: Article[]; usedProjectIds: string[]; projectById: (id: string) => BulkProject | undefined; siteById: (id: string) => BulkSite; writingFee: number; sum: number; loading: boolean; canPlace: boolean; onRemove: (id: string) => void; onBack: () => void; onPlace: () => void }) {
  const price = (a: Article) => { const s = siteById(a.siteId); return s.price + (a.type === "write" && s.kind === "blog" ? writingFee : 0); };
  return (
    <>
      <p className="mb-3 text-sm text-inkSoft">{articles.length} {articles.length === 1 ? "artikel" : "artikelen"}, gegroepeerd per project. Alles in één bestelling, op je verzamelfactuur.</p>
      <div className="space-y-3">
        {usedProjectIds.map((pid) => {
          const project = projectById(pid);
          const group = articles.filter((a) => a.projectId === pid);
          const groupSum = group.reduce((n, a) => n + price(a), 0);
          return (
            <div key={pid || "none"} className="overflow-hidden rounded-xl border border-line bg-surface">
              {project && (
                <div className="flex items-center gap-2 border-b border-line bg-gray-50 px-4 py-3 text-sm font-bold text-ink">
                  {project.name}
                  <span className="ml-auto text-xs font-semibold text-inkSoft">{group.length} artikelen · {euro(groupSum)}</span>
                </div>
              )}
              {group.map((a) => {
                const site = siteById(a.siteId);
                return (
                  <div key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-3 last:border-b-0 sm:flex-nowrap">
                    <span className="w-40 shrink-0 truncate text-sm font-semibold text-ink">{site.domain}</span>
                    <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-inkSoft">{site.kind === "homepage" ? "Homepage link" : a.type ? TYPE_LABEL[a.type] : "—"}</span>
                    <span className="min-w-0 flex-1 basis-full truncate text-sm text-inkSoft sm:basis-0">
                      {a.type === "later"
                        ? (site.kind === "homepage" ? "Link na bestelling aanleveren" : "Alles na bestelling aanleveren")
                        : a.type === "self"
                          ? (a.selfText ? "Eigen tekst" : a.docUrl ? "Google Doc" : "Artikel na bestelling")
                          : `${a.anchor || "ankertekst"} → ${a.url || "doel-URL"}${a.secondLink && a.anchor2 ? ` · + ${a.anchor2}` : ""}`}
                    </span>
                    {a.type !== "later" && (
                      <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md bg-brandSoft px-2 py-1 text-xs font-semibold text-ink"><CalendarDays size={12} />{a.publishOn ? `Live ${dayLabel(a.publishOn)}` : "Zo snel mogelijk live"}</span>
                    )}
                    <span className="w-24 shrink-0 whitespace-nowrap text-right text-sm font-semibold tabular-nums text-ink">
                      {euro(price(a))}
                      {a.type === "write" && site.kind === "blog" && writingFee > 0 && <span className="block text-[10px] font-medium text-inkSoft">incl. {euro(writingFee)} schrijven</span>}
                    </span>
                    <button type="button" onClick={() => onRemove(a.id)} className="shrink-0 text-inkSoft hover:text-red-600" aria-label="Verwijderen"><Trash2 size={16} /></button>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="mt-4 rounded-xl border border-[#ecdfbc] bg-[#fbf7ec] px-4 py-3 text-sm text-[#8a5a12]">🧾 Komt op je <span className="font-semibold">verzamelfactuur</span> — je hoeft nu niets te betalen.</div>

      <div className="mt-3 flex flex-col items-stretch gap-3 rounded-xl border border-line bg-surface px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        {(() => { const n = usedProjectIds.filter(Boolean).length; return (
          <div className="text-sm text-inkSoft">{articles.length} {articles.length === 1 ? "artikel" : "artikelen"}{n > 0 ? ` · ${n} ${n === 1 ? "project" : "projecten"}` : ""} · <span className="text-lg font-extrabold text-ink">{euro(sum)}</span> <span className="text-xs">excl. btw</span></div>
        ); })()}
        <div className="flex gap-2">
          <button type="button" onClick={onBack} className="rounded-full border border-line px-4 py-2.5 text-sm font-semibold text-inkSoft">&larr; Terug</button>
          <button type="button" disabled={loading || !canPlace} onClick={onPlace} className="btn-pay rounded-full px-5 py-2.5 text-sm font-semibold transition disabled:opacity-50">{loading ? "Bezig…" : "Bestelling bevestigen →"}</button>
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
