"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Bold,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  Heading2,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  MousePointerClick,
  Pilcrow,
  Plus,
  Quote,
  Redo2,
  Search,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { autoExcerpt, emptyBlock, newBlockId, slugify, type Block, type BlockType, type PostInput } from "@/lib/cms/blog";
import { seoScore } from "@/lib/cms/resolve";
import type { Category, EditorPost } from "@/lib/cms/blogContent";
import type { MediaItem } from "@/lib/cms/media";
import MediaPicker from "../media/MediaPicker";
import { createCategoryAction, deleteCategoryAction, discardPostDraftAction, publishPostAction, savePostAction, unpublishPostAction } from "./actions";

// De blog-editor (Admin → Publieke site → Blog). Links schrijf je in het
// artikel zelf; met "/" op een lege regel kies je een blok. Rechts staan de
// instellingen van het bericht en van het gekozen blok. Elke wijziging wordt
// na een korte pauze als concept opgeslagen; "Publiceren" zet het live.

type Props = { post: EditorPost; categories: Category[] };
type Img = { url: string; alt: string };

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const time = (iso: string) => new Date(iso).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam" });
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const INPUT = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-[13.5px] text-ink outline-none focus:border-[var(--btn-pay-bg)] focus:ring-2 focus:ring-[var(--pay-soft)]";
const LABEL = "mb-1 block text-xs font-semibold text-gray-700";
const BTN = "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13.5px] font-semibold disabled:opacity-50";
const ICON_BTN = "grid h-8 w-8 place-items-center rounded-md text-gray-600 hover:bg-gray-100 disabled:opacity-40";

const BLOCK_MENU: { type: BlockType; label: string; hint: string; icon: typeof Pilcrow; keywords: string }[] = [
  { type: "paragraph", label: "Alinea", hint: "tekst", icon: Pilcrow, keywords: "alinea tekst paragraaf p" },
  { type: "heading", label: "Tussenkop", hint: "H2 / H3", icon: Heading2, keywords: "kop tussenkop heading h2 h3 titel" },
  { type: "image", label: "Afbeelding", hint: "uit media", icon: ImageIcon, keywords: "afbeelding foto plaatje image media" },
  { type: "list", label: "Lijst", hint: "opsomming", icon: List, keywords: "lijst opsomming bullets genummerd" },
  { type: "quote", label: "Citaat", hint: "quote", icon: Quote, keywords: "citaat quote uitspraak" },
  { type: "button", label: "Knop", hint: "CTA", icon: MousePointerClick, keywords: "knop button cta link" },
];

// Artikelopmaak, gelijk aan de publieke pagina (BlogBlocks.tsx).
const ART = {
  title: "font-display text-[38px] font-extrabold leading-[1.1] tracking-[-.03em] text-pub-ink",
  p: "text-[17px] leading-[1.7] text-[#374151]",
  h2: "font-display text-[26px] font-extrabold leading-tight tracking-[-.02em] text-pub-ink",
  h3: "font-display text-[21px] font-extrabold leading-tight tracking-[-.01em] text-pub-ink",
  quote: "border-l-4 border-pub-green pl-5 text-[19px] italic leading-[1.6] text-pub-ink",
};

export default function BlogEditor({ post: initial, categories: initialCats }: Props) {
  const [post, setPost] = useState<PostInput>(initial.input);
  const [status, setStatus] = useState(initial.status);
  const [hasDraft, setHasDraft] = useState(initial.hasDraft);
  const [savedAt, setSavedAt] = useState<string | null>(initial.updatedAt);
  const [savedSlug, setSavedSlug] = useState(initial.input.slug);
  const [saveState, setSaveState] = useState<"idle" | "dirty" | "saving" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "publish" | "unpublish" | "discard">(null);
  const [images, setImages] = useState<Record<string, Img>>(initial.images);
  const [cats, setCats] = useState<Category[]>(initialCats);
  const [newCat, setNewCat] = useState("");
  const [tab, setTab] = useState<"post" | "block">("post");
  const [selected, setSelected] = useState<string | null>(null);
  const [slash, setSlash] = useState<{ blockId: string; query: string; index: number } | null>(null);
  const [picker, setPicker] = useState<null | { target: "featured" | string }>(null);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.input.title) && slugify(initial.input.title) !== initial.input.slug);

  const history = useRef<{ past: PostInput[]; future: PostInput[] }>({ past: [], future: [] });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(post);
  latest.current = post;
  const pendingFocus = useRef<{ id: string; at?: "end" | number } | null>(null);
  const activeField = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);

  // --- opslaan -----------------------------------------------------------
  const persist = useCallback(async () => {
    setSaveState("saving");
    const r = await savePostAction(initial.id, latest.current);
    if (r.ok) {
      setSavedAt(r.savedAt);
      setSavedSlug(r.slug);
      if (r.slug !== latest.current.slug) setPost((p) => ({ ...p, slug: r.slug }));
      if (status === "published") setHasDraft(true);
      setSaveState("idle");
      setError(null);
    } else {
      setSaveState("error");
      setError(r.error);
    }
  }, [initial.id, status]);

  const schedule = useCallback(() => {
    setSaveState("dirty");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(persist, 900);
  }, [persist]);

  const update = useCallback(
    (mutate: (d: PostInput) => void, { record = true }: { record?: boolean } = {}) => {
      setPost((prev) => {
        if (record) {
          history.current.past = [...history.current.past.slice(-79), prev];
          history.current.future = [];
        }
        const next = clone(prev);
        mutate(next);
        return next;
      });
      schedule();
    },
    [schedule]
  );
  const undo = () => {
    const prev = history.current.past.pop();
    if (!prev) return;
    history.current.future.push(post);
    setPost(prev);
    schedule();
  };
  const redo = () => {
    const next = history.current.future.pop();
    if (!next) return;
    history.current.past.push(post);
    setPost(next);
    schedule();
  };

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (saveState === "dirty" || saveState === "saving") e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveState]);

  // Focus na het toevoegen/verwijderen van een blok.
  useEffect(() => {
    const f = pendingFocus.current;
    if (!f) return;
    pendingFocus.current = null;
    const el = document.querySelector<HTMLTextAreaElement | HTMLInputElement>(`[data-block-field="${f.id}"]`);
    if (!el) return;
    el.focus();
    const pos = f.at === "end" || f.at === undefined ? el.value.length : f.at;
    try {
      el.setSelectionRange(pos, pos);
    } catch {}
  });

  // --- blokken -------------------------------------------------------------
  const blocks = post.content;
  const idx = (id: string) => blocks.findIndex((b) => b.id === id);
  const insertAfter = (afterId: string | null, block: Block) =>
    update((d) => {
      const i = afterId ? d.content.findIndex((b) => b.id === afterId) : -1;
      d.content.splice(i + 1, 0, block);
    });
  const replaceBlock = (id: string, block: Block) => update((d) => void (d.content = d.content.map((b) => (b.id === id ? block : b))));
  const removeBlock = (id: string, focusPrev = true) => {
    const i = idx(id);
    const prev = blocks[i - 1];
    update((d) => void (d.content = d.content.filter((b) => b.id !== id)));
    if (focusPrev && prev) pendingFocus.current = { id: prev.id, at: "end" };
    if (selected === id) setSelected(null);
  };
  const moveBlock = (id: string, dir: -1 | 1) =>
    update((d) => {
      const i = d.content.findIndex((b) => b.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= d.content.length) return;
      [d.content[i], d.content[j]] = [d.content[j], d.content[i]];
    });
  const duplicateBlock = (id: string) => {
    const b = blocks[idx(id)];
    if (b) insertAfter(id, { ...clone(b), id: newBlockId() });
  };
  const setBlock = <B extends Block>(id: string, patch: Partial<B>) =>
    update((d) => void (d.content = d.content.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b))));

  const addParagraphAfter = (afterId: string | null, text = "") => {
    const b = emptyBlock("paragraph") as Extract<Block, { type: "paragraph" }>;
    b.text = text;
    insertAfter(afterId, b);
    pendingFocus.current = { id: b.id, at: 0 };
  };

  const chooseBlockType = (blockId: string, type: BlockType) => {
    const b = emptyBlock(type);
    b.id = blockId;
    replaceBlock(blockId, b);
    setSlash(null);
    setSelected(blockId);
    if (type === "image") setPicker({ target: blockId });
    else pendingFocus.current = { id: blockId, at: 0 };
  };

  const slashItems = BLOCK_MENU.filter((m) => !slash?.query || m.keywords.includes(slash.query.toLowerCase()) || m.label.toLowerCase().includes(slash.query.toLowerCase()));

  // Toetsen in een tekstblok: Enter = nieuwe alinea, Backspace op leeg = weg, "/" = blokmenu.
  const onTextKey = (b: Block, e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    if (slash?.blockId === b.id) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlash({ ...slash, index: Math.min(slash.index + 1, slashItems.length - 1) });
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlash({ ...slash, index: Math.max(slash.index - 1, 0) });
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const item = slashItems[slash.index] ?? slashItems[0];
        if (item) chooseBlockType(b.id, item.type);
        return;
      }
      if (e.key === "Escape") {
        setSlash(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey && (b.type === "paragraph" || b.type === "heading")) {
      e.preventDefault();
      const pos = el.selectionStart ?? el.value.length;
      const before = el.value.slice(0, pos);
      const after = el.value.slice(pos);
      if (after) setBlock(b.id, { text: before } as Partial<Block>);
      addParagraphAfter(b.id, after);
    }
    if (e.key === "Backspace" && el.value === "" && blocks.length > 1) {
      e.preventDefault();
      removeBlock(b.id);
    }
  };
  const onTextChange = (b: Block, value: string) => {
    setBlock(b.id, { text: value } as Partial<Block>);
    if (b.type === "paragraph" && value.startsWith("/") && !value.includes(" ")) setSlash({ blockId: b.id, query: value.slice(1), index: 0 });
    else if (slash?.blockId === b.id) setSlash(null);
  };

  // Inline opmaak op de selectie van het actieve tekstveld.
  const wrapSelection = (before: string, after: string, placeholder: string) => {
    const el = activeField.current;
    const field = el?.dataset.blockField;
    if (!el || !field) return;
    const b = blocks.find((x) => x.id === field);
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const sel = el.value.slice(start, end) || placeholder;
    const next = el.value.slice(0, start) + before + sel + after + el.value.slice(end);
    if (b && (b.type === "paragraph" || b.type === "heading" || b.type === "quote")) setBlock(b.id, { text: next } as Partial<Block>);
    else if (b && b.type === "list") {
      const i = Number(el.dataset.itemIndex ?? -1);
      if (i >= 0) setBlock(b.id, { items: b.items.map((it, j) => (j === i ? next : it)) } as Partial<Block>);
    }
    pendingFocus.current = { id: field, at: start + before.length + sel.length + after.length };
  };
  const addLink = () => {
    const url = prompt("Link (https://… of /pad):", "https://");
    if (!url) return;
    wrapSelection("[", `](${url.trim()})`, "linktekst");
  };

  // --- acties --------------------------------------------------------------
  const doPublish = async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setBusy("publish");
    const r = await publishPostAction(initial.id, latest.current);
    setBusy(null);
    if (r.ok) {
      setStatus("published");
      setHasDraft(false);
      setSavedAt(r.savedAt);
      setSavedSlug(r.slug);
      setSaveState("idle");
      setError(null);
      if (!latest.current.publishedAt) setPost((p) => ({ ...p, publishedAt: new Date().toISOString() }));
    } else setError(r.error);
  };
  const applyFresh = (p: EditorPost) => {
    history.current = { past: [], future: [] };
    setPost(p.input);
    setStatus(p.status);
    setHasDraft(p.hasDraft);
    setImages(p.images);
    setSavedSlug(p.input.slug);
    setSaveState("idle");
  };
  const doUnpublish = async () => {
    if (!confirm("Bericht offline halen? Het blijft bewaard als concept.")) return;
    setBusy("unpublish");
    const r = await unpublishPostAction(initial.id);
    setBusy(null);
    if ("ok" in r && r.ok === false) return setError(r.error);
    applyFresh(r as EditorPost);
  };
  const doDiscard = async () => {
    if (!confirm("Niet-gepubliceerde wijzigingen weggooien en terug naar wat live staat?")) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setBusy("discard");
    const r = await discardPostDraftAction(initial.id);
    setBusy(null);
    if ("ok" in r && r.ok === false) return setError(r.error);
    applyFresh(r as EditorPost);
  };
  const addCategory = async () => {
    const name = newCat.trim();
    if (!name) return;
    const r = await createCategoryAction(name);
    if ("ok" in r && r.ok === false) return setError(r.error);
    const c = r as Category;
    setCats((prev) => (prev.some((x) => x.id === c.id) ? prev : [...prev, c]));
    update((d) => void (d.categories = Array.from(new Set([...d.categories, c.slug]))));
    setNewCat("");
  };
  const removeCategory = async (c: Category) => {
    if (!confirm(`Categorie "${c.name}" verwijderen? Berichten blijven bestaan.`)) return;
    const r = await deleteCategoryAction(c.id);
    if (!r.ok) return setError(r.error);
    setCats((prev) => prev.filter((x) => x.id !== c.id));
    update((d) => void (d.categories = d.categories.filter((s) => s !== c.slug)));
  };
  const onPick = (m: MediaItem) => {
    setImages((prev) => ({ ...prev, [m.id]: { url: m.url, alt: m.alt } }));
    if (picker?.target === "featured") update((d) => void (d.featuredImageId = m.id));
    else if (picker) setBlock(picker.target, { mediaId: m.id, alt: m.alt } as Partial<Block>);
    setPicker(null);
  };

  const scheduled = status === "published" && post.publishedAt && Date.parse(post.publishedAt) > Date.now();
  const statusLabel = status === "published" ? (scheduled ? "Ingepland" : "Gepubliceerd") : "Concept";
  const saveLabel =
    saveState === "saving" ? "Opslaan…" : saveState === "dirty" ? "Niet-opgeslagen wijzigingen" : saveState === "error" ? "Opslaan mislukt" : savedAt ? `${hasDraft ? "Concept" : statusLabel} · opgeslagen om ${time(savedAt)}` : statusLabel;
  const seo = { title: post.seoTitle || post.title, description: post.seoDescription || post.excerpt || autoExcerpt(post.content), keyword: post.focusKeyword };
  const selectedBlock = selected ? blocks.find((b) => b.id === selected) ?? null : null;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-white text-ink">
      {/* Bovenbalk */}
      <div className="flex h-[60px] shrink-0 items-center gap-2 border-b border-line px-3 sm:px-4">
        <Link href="/admin/site/blog" className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 text-[13.5px] font-semibold text-gray-700 hover:bg-gray-200">
          <ArrowLeft size={15} /> Blog
        </Link>
        <button type="button" className={ICON_BTN} onClick={undo} title="Ongedaan maken" disabled={history.current.past.length === 0}>
          <Undo2 size={17} />
        </button>
        <button type="button" className={ICON_BTN} onClick={redo} title="Opnieuw" disabled={history.current.future.length === 0}>
          <Redo2 size={17} />
        </button>
        <span className="mx-1 h-6 w-px bg-line" />
        <button type="button" className={ICON_BTN} title="Vet (**tekst**)" onMouseDown={(e) => e.preventDefault()} onClick={() => wrapSelection("**", "**", "vet")}>
          <Bold size={16} />
        </button>
        <button type="button" className={ICON_BTN} title="Cursief (*tekst*)" onMouseDown={(e) => e.preventDefault()} onClick={() => wrapSelection("*", "*", "cursief")}>
          <Italic size={16} />
        </button>
        <button type="button" className={ICON_BTN} title="Link" onMouseDown={(e) => e.preventDefault()} onClick={addLink}>
          <Link2 size={16} />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <div className="truncate text-sm font-semibold">{post.title || "Nieuw bericht"}</div>
          <div className={`truncate text-xs ${saveState === "error" ? "text-red-700" : "text-inkSoft"}`}>{saveLabel}</div>
        </div>
        {status === "published" && hasDraft && (
          <button type="button" onClick={doDiscard} disabled={busy !== null} className={`${BTN} text-gray-700 hover:bg-gray-100`}>
            {busy === "discard" ? "Bezig…" : "Concept weggooien"}
          </button>
        )}
        {status === "published" && (
          <button type="button" onClick={doUnpublish} disabled={busy !== null} className={`${BTN} text-red-700 hover:bg-red-50`}>
            {busy === "unpublish" ? "Bezig…" : "Offline halen"}
          </button>
        )}
        <a href={`/blog/${savedSlug}?cms=preview`} target="_blank" rel="noreferrer" className={`${BTN} border border-line bg-white text-ink hover:bg-gray-50`}>
          <Eye size={15} /> Voorbeeld
        </a>
        <button type="button" onClick={doPublish} disabled={busy !== null || saveState === "saving"} className={`${BTN} bg-[var(--btn-pay-bg)] text-white hover:brightness-95`}>
          {busy === "publish" ? "Bezig…" : status === "published" ? "Bijwerken" : "Publiceren"}
        </button>
      </div>
      {error && (
        <div className="flex items-center gap-3 border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          {error}
          <button type="button" className="ml-auto" onClick={() => setError(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Canvas */}
        <div className="min-w-0 flex-1 overflow-y-auto bg-[#eef0ef] px-4 py-6 sm:px-8" onClick={() => setSlash(null)}>
          <article className="mx-auto min-h-[70vh] w-full max-w-[820px] rounded-lg bg-white px-8 py-10 shadow-sm sm:px-16 sm:py-14">
            <AutoTextarea
              className={`${ART.title} w-full resize-none bg-transparent outline-none placeholder:text-gray-300`}
              placeholder="Titel van het bericht"
              value={post.title}
              onFocus={(e) => (activeField.current = e.currentTarget)}
              onChange={(v) =>
                update((d) => {
                  d.title = v;
                  if (!slugTouched) d.slug = slugify(v);
                })
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (blocks[0]) pendingFocus.current = { id: blocks[0].id, at: 0 };
                  else addParagraphAfter(null);
                  setPost((p) => p);
                }
              }}
            />
            <div className="mt-7 grid gap-5">
              {blocks.map((b, i) => (
                <div
                  key={b.id}
                  className={`group relative rounded-md ${selected === b.id ? "ring-2 ring-[#bfdbfe] ring-offset-4" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelected(b.id);
                    setTab("block");
                  }}
                >
                  {/* Blokknoppen */}
                  <div className="absolute -right-2 -top-3 z-10 hidden items-center gap-0.5 rounded-lg border border-line bg-white p-0.5 shadow-sm group-hover:flex">
                    <button type="button" className={ICON_BTN} title="Omhoog" disabled={i === 0} onClick={() => moveBlock(b.id, -1)}>
                      <ChevronUp size={14} />
                    </button>
                    <button type="button" className={ICON_BTN} title="Omlaag" disabled={i === blocks.length - 1} onClick={() => moveBlock(b.id, 1)}>
                      <ChevronDown size={14} />
                    </button>
                    <button type="button" className={ICON_BTN} title="Dupliceren" onClick={() => duplicateBlock(b.id)}>
                      <Copy size={14} />
                    </button>
                    <button type="button" className={ICON_BTN} title="Blok toevoegen" onClick={() => addParagraphAfter(b.id)}>
                      <Plus size={14} />
                    </button>
                    <button type="button" className={`${ICON_BTN} hover:text-red-700`} title="Verwijderen" onClick={() => removeBlock(b.id, false)}>
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <BlockView
                    block={b}
                    images={images}
                    onFocus={(el) => (activeField.current = el)}
                    onTextChange={(v) => onTextChange(b, v)}
                    onTextKey={(e) => onTextKey(b, e)}
                    onPatch={(patch) => setBlock(b.id, patch)}
                    onPickImage={() => setPicker({ target: b.id })}
                    onListKey={(itemIndex, e) => {
                      if (b.type !== "list") return;
                      const el = e.currentTarget;
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const items = [...b.items];
                        items.splice(itemIndex + 1, 0, "");
                        setBlock(b.id, { items } as Partial<Block>);
                        pendingFocus.current = { id: `${b.id}:${itemIndex + 1}`, at: 0 };
                      } else if (e.key === "Backspace" && el.value === "") {
                        e.preventDefault();
                        if (b.items.length <= 1) removeBlock(b.id);
                        else {
                          setBlock(b.id, { items: b.items.filter((_, j) => j !== itemIndex) } as Partial<Block>);
                          pendingFocus.current = { id: `${b.id}:${Math.max(0, itemIndex - 1)}`, at: "end" };
                        }
                      }
                    }}
                  />

                  {slash?.blockId === b.id && (
                    <div className="absolute left-0 top-full z-20 mt-1 w-[300px] rounded-xl border border-line bg-white p-1.5 shadow-[0_18px_40px_-12px_rgba(0,0,0,.25)]" onClick={(e) => e.stopPropagation()}>
                      <div className="px-2.5 py-1.5 text-xs text-inkSoft">Blok kiezen</div>
                      {slashItems.length === 0 && <div className="px-2.5 py-2 text-sm text-inkSoft">Geen blok gevonden</div>}
                      {slashItems.map((m, j) => (
                        <button
                          key={m.type}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => chooseBlockType(b.id, m.type)}
                          className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13.5px] ${j === slash.index ? "bg-blue-50 text-blue-800" : "hover:bg-gray-50"}`}
                        >
                          <m.icon size={16} />
                          {m.label}
                          <span className="ml-auto text-[11.5px] text-gray-400">{m.hint}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                addParagraphAfter(blocks[blocks.length - 1]?.id ?? null);
              }}
              className="mt-8 inline-flex items-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-[13px] text-inkSoft hover:border-[var(--btn-pay-bg)] hover:text-ink"
            >
              <Plus size={14} /> Alinea toevoegen · typ <kbd className="rounded border border-gray-300 bg-gray-50 px-1">/</kbd> voor een ander blok
            </button>
          </article>
        </div>

        {/* Paneel */}
        <aside className="flex w-[360px] shrink-0 flex-col border-l border-line bg-white">
          <div className="flex shrink-0 border-b border-line">
            {(["post", "block"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setTab(t)} className={`flex-1 py-3 text-[13.5px] font-semibold ${tab === t ? "text-ink shadow-[inset_0_-2px_0_var(--btn-pay-bg)]" : "text-inkSoft"}`}>
                {t === "post" ? "Bericht" : "Blok"}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === "post" ? (
              <>
                <Panel title="Publiceren">
                  <Row label="Status">
                    <b>{hasDraft ? `${statusLabel} · concept` : statusLabel}</b>
                  </Row>
                  <div className="mt-2">
                    <label className={LABEL}>Publicatiedatum</label>
                    <input
                      type="datetime-local"
                      className={INPUT}
                      value={toLocalInput(post.publishedAt)}
                      onChange={(e) => update((d) => void (d.publishedAt = e.target.value ? new Date(e.target.value).toISOString() : null))}
                    />
                    <p className="mt-1 text-[11.5px] text-inkSoft">Leeg = het moment van publiceren. Een datum in de toekomst plant het bericht in.</p>
                  </div>
                  <div className="mt-3">
                    <label className={LABEL}>Adres</label>
                    <div className="flex items-center gap-1 text-[13px] text-inkSoft">
                      <span className="shrink-0">publito.nl/blog/</span>
                      <input
                        className={`${INPUT} !py-1.5`}
                        value={post.slug}
                        onChange={(e) => {
                          setSlugTouched(true);
                          update((d) => void (d.slug = slugify(e.target.value) || d.slug));
                        }}
                      />
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className={LABEL}>Auteur</label>
                    <input className={INPUT} value={post.authorName} onChange={(e) => update((d) => void (d.authorName = e.target.value))} />
                  </div>
                </Panel>
                <Panel title="Samenvatting">
                  <textarea className={`${INPUT} min-h-[72px]`} placeholder={autoExcerpt(post.content) || "Korte samenvatting voor het overzicht en Google."} value={post.excerpt} onChange={(e) => update((d) => void (d.excerpt = e.target.value))} />
                </Panel>
                <Panel title="Categorie">
                  {cats.length === 0 && <p className="mb-2 text-[13px] text-inkSoft">Nog geen categorieën.</p>}
                  {cats.map((c) => (
                    <label key={c.id} className="group/cat flex items-center gap-2 py-1 text-[13.5px]">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[var(--btn-pay-bg)]"
                        checked={post.categories.includes(c.slug)}
                        onChange={(e) => update((d) => void (d.categories = e.target.checked ? [...d.categories, c.slug] : d.categories.filter((s) => s !== c.slug)))}
                      />
                      <span className="flex-1">{c.name}</span>
                      <button type="button" className="hidden text-gray-400 hover:text-red-700 group-hover/cat:block" title="Categorie verwijderen" onClick={() => removeCategory(c)}>
                        <X size={13} />
                      </button>
                    </label>
                  ))}
                  <div className="mt-2 flex gap-2">
                    <input
                      className={`${INPUT} !py-1.5`}
                      placeholder="Nieuwe categorie"
                      value={newCat}
                      onChange={(e) => setNewCat(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addCategory();
                        }
                      }}
                    />
                    <button type="button" onClick={addCategory} className={`${BTN} border border-line bg-white !px-2.5`} title="Toevoegen">
                      <Plus size={15} />
                    </button>
                  </div>
                </Panel>
                <Panel title="Uitgelichte afbeelding">
                  {post.featuredImageId && images[post.featuredImageId] ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={images[post.featuredImageId].url} alt={images[post.featuredImageId].alt} className="w-full rounded-lg border border-line bg-[#f3f4f3]" />
                      <div className="mt-2 flex gap-3 text-[13px]">
                        <button type="button" className="font-semibold text-[var(--btn-pay-bg)]" onClick={() => setPicker({ target: "featured" })}>
                          Vervangen
                        </button>
                        <button type="button" className="text-red-700" onClick={() => update((d) => void (d.featuredImageId = null))}>
                          Verwijderen
                        </button>
                      </div>
                    </>
                  ) : (
                    <button type="button" onClick={() => setPicker({ target: "featured" })} className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 py-6 text-[13.5px] text-inkSoft hover:border-[var(--btn-pay-bg)] hover:text-ink">
                      <ImageIcon size={16} /> Afbeelding kiezen
                    </button>
                  )}
                </Panel>
                <Panel title="SEO" right={<SeoDot seo={seo} />}>
                  <div className="grid gap-3">
                    <div>
                      <label className={LABEL}>Focuszoekwoord</label>
                      <input className={INPUT} value={post.focusKeyword} onChange={(e) => update((d) => void (d.focusKeyword = e.target.value))} />
                    </div>
                    <div>
                      <label className={LABEL}>SEO-titel</label>
                      <input className={INPUT} placeholder={post.title} value={post.seoTitle} onChange={(e) => update((d) => void (d.seoTitle = e.target.value))} />
                      <Meter n={seo.title.length} min={30} max={60} />
                    </div>
                    <div>
                      <label className={LABEL}>Meta-omschrijving</label>
                      <textarea className={`${INPUT} min-h-[72px]`} placeholder={seo.description} value={post.seoDescription} onChange={(e) => update((d) => void (d.seoDescription = e.target.value))} />
                      <Meter n={seo.description.length} min={110} max={160} />
                    </div>
                    <div className="rounded-lg border border-line p-3">
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gray-100">
                          <Search size={11} />
                        </span>
                        publito.nl › blog › {post.slug || "…"}
                      </div>
                      <div className="mt-1.5 text-[16px] leading-snug text-[#1a0dab]">{seo.title || "Titel van het bericht"}</div>
                      <div className="mt-1 text-[12.5px] leading-relaxed text-[#4d5156]">{seo.description || "Meta-omschrijving"}</div>
                    </div>
                  </div>
                </Panel>
              </>
            ) : selectedBlock ? (
              <BlockSettings block={selectedBlock} images={images} onPatch={(patch) => setBlock(selectedBlock.id, patch)} onPickImage={() => setPicker({ target: selectedBlock.id })} onDelete={() => removeBlock(selectedBlock.id, false)} />
            ) : (
              <div className="p-6 text-center text-[13.5px] text-inkSoft">Klik op een blok in het artikel om de instellingen te zien.</div>
            )}
          </div>
        </aside>
      </div>

      {picker && <MediaPicker onSelect={onPick} onClose={() => setPicker(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------- blokken

function BlockView({
  block: b,
  images,
  onFocus,
  onTextChange,
  onTextKey,
  onPatch,
  onPickImage,
  onListKey,
}: {
  block: Block;
  images: Record<string, Img>;
  onFocus: (el: HTMLTextAreaElement | HTMLInputElement) => void;
  onTextChange: (v: string) => void;
  onTextKey: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onPatch: (patch: Partial<Block>) => void;
  onPickImage: () => void;
  onListKey: (itemIndex: number, e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}) {
  switch (b.type) {
    case "paragraph":
      return (
        <AutoTextarea
          fieldId={b.id}
          className={`${ART.p} w-full resize-none bg-transparent outline-none placeholder:text-gray-300`}
          placeholder="Schrijf hier, of typ / voor een blok"
          value={b.text}
          onFocus={(e) => onFocus(e.currentTarget)}
          onChange={onTextChange}
          onKeyDown={onTextKey}
        />
      );
    case "heading":
      return (
        <AutoTextarea
          fieldId={b.id}
          className={`${b.level === 2 ? ART.h2 : ART.h3} w-full resize-none bg-transparent outline-none placeholder:text-gray-300`}
          placeholder="Tussenkop"
          value={b.text}
          onFocus={(e) => onFocus(e.currentTarget)}
          onChange={onTextChange}
          onKeyDown={onTextKey}
        />
      );
    case "quote":
      return (
        <div className={ART.quote}>
          <AutoTextarea fieldId={b.id} className="w-full resize-none bg-transparent outline-none placeholder:text-gray-300" placeholder="Citaat" value={b.text} onFocus={(e) => onFocus(e.currentTarget)} onChange={onTextChange} onKeyDown={onTextKey} />
          <input className="mt-1 w-full bg-transparent text-[14px] not-italic text-inkSoft outline-none placeholder:text-gray-300" placeholder="— Naam, functie" value={b.cite} onChange={(e) => onPatch({ cite: e.target.value } as Partial<Block>)} />
        </div>
      );
    case "list": {
      const Tag = b.ordered ? "ol" : "ul";
      return (
        <Tag className={`${ART.p} grid gap-1.5 pl-6 ${b.ordered ? "list-decimal" : "list-disc"} marker:text-pub-green`}>
          {b.items.map((it, i) => (
            <li key={i}>
              <AutoTextarea
                fieldId={`${b.id}:${i}`}
                itemIndex={i}
                className="w-full resize-none bg-transparent outline-none placeholder:text-gray-300"
                placeholder="Punt"
                value={it}
                onFocus={(e) => onFocus(e.currentTarget)}
                onChange={(v) => onPatch({ items: b.items.map((x, j) => (j === i ? v : x)) } as Partial<Block>)}
                onKeyDown={(e) => onListKey(i, e)}
              />
            </li>
          ))}
        </Tag>
      );
    }
    case "image": {
      const img = b.mediaId ? images[b.mediaId] : null;
      return (
        <figure>
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img.url} alt={b.alt || img.alt} className="w-full cursor-pointer rounded-xl border border-pub-line" onClick={onPickImage} title="Klik om te vervangen" />
          ) : (
            <button type="button" onClick={onPickImage} className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 py-12 text-[14px] text-inkSoft hover:border-[var(--btn-pay-bg)] hover:text-ink">
              <ImageIcon size={18} /> Afbeelding kiezen of uploaden
            </button>
          )}
          <input className="mt-2 w-full bg-transparent text-center text-[13px] text-inkSoft outline-none placeholder:text-gray-300" placeholder="Onderschrift (optioneel)" value={b.caption} onChange={(e) => onPatch({ caption: e.target.value } as Partial<Block>)} />
        </figure>
      );
    }
    case "button":
      return (
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center rounded-xl bg-pub-green px-5 py-3 text-[15px] font-semibold text-white">
            <input className="min-w-[80px] bg-transparent text-center outline-none placeholder:text-white/60" size={Math.max(8, b.label.length)} placeholder="Knoptekst" value={b.label} onChange={(e) => onPatch({ label: e.target.value } as Partial<Block>)} />
          </span>
          <input className={`${INPUT} max-w-[300px] !py-1.5`} placeholder="/register of https://…" value={b.href} onChange={(e) => onPatch({ href: e.target.value } as Partial<Block>)} />
        </div>
      );
  }
}

function BlockSettings({ block: b, images, onPatch, onPickImage, onDelete }: { block: Block; images: Record<string, Img>; onPatch: (patch: Partial<Block>) => void; onPickImage: () => void; onDelete: () => void }) {
  const label = BLOCK_MENU.find((m) => m.type === b.type)?.label ?? b.type;
  return (
    <>
      <Panel title={label}>
        {b.type === "heading" && (
          <div className="flex gap-2">
            {([2, 3] as const).map((l) => (
              <button key={l} type="button" onClick={() => onPatch({ level: l } as Partial<Block>)} className={`rounded-lg border px-3 py-1.5 text-[13px] font-semibold ${b.level === l ? "border-[var(--btn-pay-bg)] bg-[var(--pay-soft)] text-[var(--btn-pay-bg)]" : "border-line"}`}>
                H{l}
              </button>
            ))}
          </div>
        )}
        {b.type === "list" && (
          <div className="flex gap-2">
            <button type="button" onClick={() => onPatch({ ordered: false } as Partial<Block>)} className={`${BTN} border ${!b.ordered ? "border-[var(--btn-pay-bg)] bg-[var(--pay-soft)] text-[var(--btn-pay-bg)]" : "border-line"}`}>
              <List size={15} /> Opsomming
            </button>
            <button type="button" onClick={() => onPatch({ ordered: true } as Partial<Block>)} className={`${BTN} border ${b.ordered ? "border-[var(--btn-pay-bg)] bg-[var(--pay-soft)] text-[var(--btn-pay-bg)]" : "border-line"}`}>
              <ListOrdered size={15} /> Genummerd
            </button>
          </div>
        )}
        {b.type === "image" && (
          <>
            {b.mediaId && images[b.mediaId] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={images[b.mediaId].url} alt="" className="mb-3 w-full rounded-lg border border-line" />
            )}
            <button type="button" onClick={onPickImage} className={`${BTN} mb-3 border border-line bg-white`}>
              <ImageIcon size={15} /> {b.mediaId ? "Vervangen" : "Afbeelding kiezen"}
            </button>
            <label className={LABEL}>Alt-tekst</label>
            <input className={INPUT} value={b.alt} onChange={(e) => onPatch({ alt: e.target.value } as Partial<Block>)} placeholder={b.mediaId ? images[b.mediaId]?.alt : ""} />
            <label className={`${LABEL} mt-3`}>Onderschrift</label>
            <input className={INPUT} value={b.caption} onChange={(e) => onPatch({ caption: e.target.value } as Partial<Block>)} />
          </>
        )}
        {b.type === "button" && (
          <>
            <label className={LABEL}>Knoptekst</label>
            <input className={INPUT} value={b.label} onChange={(e) => onPatch({ label: e.target.value } as Partial<Block>)} />
            <label className={`${LABEL} mt-3`}>Link</label>
            <input className={INPUT} value={b.href} onChange={(e) => onPatch({ href: e.target.value } as Partial<Block>)} placeholder="/register of https://…" />
          </>
        )}
        {b.type === "quote" && (
          <>
            <label className={LABEL}>Bron</label>
            <input className={INPUT} value={b.cite} onChange={(e) => onPatch({ cite: e.target.value } as Partial<Block>)} placeholder="Naam, functie" />
          </>
        )}
        {b.type === "paragraph" && <p className="text-[13px] text-inkSoft">Opmaak: selecteer tekst en gebruik de knoppen bovenin, of typ **vet**, *cursief* en [tekst](https://link).</p>}
      </Panel>
      <div className="px-4 py-3">
        <button type="button" onClick={onDelete} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-red-700 hover:underline">
          <Trash2 size={14} /> Blok verwijderen
        </button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- onderdelen

function AutoTextarea({
  value,
  onChange,
  fieldId,
  itemIndex,
  className,
  ...rest
}: Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value"> & { value: string; onChange: (v: string) => void; fieldId?: string; itemIndex?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return <textarea ref={ref} rows={1} data-block-field={fieldId} data-item-index={itemIndex} className={className} value={value} onChange={(e) => onChange(e.target.value)} {...rest} />;
}

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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1 text-[13px] text-gray-600">
      <span>{label}</span>
      <span className="text-ink">{children}</span>
    </div>
  );
}

function SeoDot({ seo }: { seo: { title: string; description: string; keyword: string } }) {
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
  return (
    <div className="mt-1">
      <div className="h-1 overflow-hidden rounded bg-gray-200">
        <div className={`h-full ${ok ? "bg-green-500" : n > max ? "bg-red-500" : "bg-amber-400"}`} style={{ width: `${Math.min(100, (n / max) * 100)}%` }} />
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
