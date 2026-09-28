"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Sparkles, X } from "lucide-react";
import RichTextEditor from "@/components/RichTextEditor";
import PhotoPicker from "@/components/PhotoPicker";
import { TITLE_MAX_LENGTH } from "@/lib/validations/order";
import { wpSlugify } from "@/lib/wpSlug";
import type { BriefLink } from "@/lib/writingService";
import { adminPublishToWordPressAction, adminSaveItemAction, adminWriteArticleAction } from "./actions";

// Same check as missingBriefLinks in lib/articleWriter.ts (server-only file).
function hasLink(html: string, url: string): boolean {
  const target = url.replace(/\/$/, "");
  return Array.from(html.matchAll(/<a\s[^>]*href="([^"]*)"/gi)).some(
    (m) => m[1].replace(/&amp;/g, "&").replace(/\/$/, "") === target
  );
}

type Article = { title: string; slug: string; body: string; imageKey: string };
type Link = { anchorText: string; targetUrl: string; nofollow: boolean };

const inputClass =
  "w-full rounded-lg border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--btn-pay-bg)]";

// Checking and changing what the customer ordered, in the same fields they
// filled in: an article (title, URL, text, picture from the photo search,
// as in the order form) or a homepage-link.
// Before it's placed: Opslaan, and Publiceren to put it on the site. Once
// it's on the site: "Aanpassen" opens the same fields, and the site takes
// over the new version.
export default function EditItemForm({
  orderItemId,
  live,
  canPublish,
  updatePending,
  article,
  link,
  urlPrefix,
  writeForMe = false,
  links = [],
  aiEnabled = false,
  photoSearchEnabled = false,
}: {
  orderItemId: string;
  // Already on the site: changes go out as an update.
  live: boolean;
  // The site can take it (plugin or WordPress connection) via Publiceren.
  canPublish: boolean;
  updatePending: boolean;
  article?: Article;
  link?: Link;
  // What comes before the slug, e.g. "https://digikeur.nl/blog/"; null when
  // the site's URLs hold more than the slug (such as the category).
  urlPrefix?: string | null;
  writeForMe?: boolean;
  links?: BriefLink[];
  aiEnabled?: boolean;
  photoSearchEnabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(!live);
  const [title, setTitle] = useState(article?.title ?? "");
  // Follows the title until the admin types their own.
  const [slug, setSlug] = useState(article?.slug || wpSlugify(article?.title ?? ""));
  const [slugTouched, setSlugTouched] = useState(Boolean(article?.slug));
  const [body, setBody] = useState(article?.body ?? "");
  const [imageKey, setImageKey] = useState(article?.imageKey ?? "");
  const [choosingImage, setChoosingImage] = useState(!article?.imageKey);
  const [anchorText, setAnchorText] = useState(link?.anchorText ?? "");
  const [targetUrl, setTargetUrl] = useState(link?.targetUrl ?? "");
  const [nofollow, setNofollow] = useState(link?.nofollow ?? false);
  const [busy, setBusy] = useState<"" | "save" | "publish" | "write">("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const isLink = Boolean(link);
  const hasText = body.replace(/<[^>]*>/g, "").trim().length > 0;
  const initialSlug = article ? article.slug || wpSlugify(article.title) : "";
  const dirty = isLink
    ? anchorText !== link!.anchorText || targetUrl !== link!.targetUrl || nofollow !== link!.nofollow
    : title !== article!.title || body !== article!.body || imageKey !== article!.imageKey || slug !== initialSlug;

  function changeTitle(value: string) {
    setTitle(value);
    if (!slugTouched) setSlug(wpSlugify(value));
  }

  async function save(): Promise<boolean> {
    const result = await adminSaveItemAction(
      isLink
        ? { orderItemId, kind: "link", anchorText, targetUrl, nofollow }
        : { orderItemId, kind: "article", articleTitle: title, articleSlug: slug, articleBody: body, articleImageKey: imageKey }
    );
    if (!result.success) {
      setError(result.error ?? "Opslaan mislukt.");
      return false;
    }
    return true;
  }

  async function run(kind: "save" | "publish", e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setBusy(kind);
    try {
      if (!(await save())) return;
      if (kind === "publish") {
        const result = await adminPublishToWordPressAction({ orderItemId });
        if (!result.success) {
          setError(result.error ?? "Publiceren mislukt.");
          router.refresh();
          return;
        }
      }
      setSaved(true);
      if (live) setOpen(false);
      router.refresh();
    } catch {
      setError("Er ging iets mis. Probeer het opnieuw.");
    } finally {
      setBusy("");
    }
  }

  async function handleWrite() {
    if (hasText && !window.confirm("De huidige tekst wordt vervangen door een nieuwe versie. Doorgaan?")) return;
    setError(null);
    setBusy("write");
    try {
      const result = await adminWriteArticleAction({ orderItemId });
      if (result.error || !result.title || !result.html) {
        setError(result.error ?? "Schrijven mislukt.");
        return;
      }
      changeTitle(result.title);
      setBody(result.html);
    } catch {
      setError("Schrijven mislukt. Probeer het opnieuw.");
    } finally {
      setBusy("");
    }
  }

  const what = isLink ? "link" : "artikel";

  if (!open) {
    return (
      <div className="space-y-2">
        {updatePending && (
          <p className="text-sm text-ink">Je wijziging wordt op de site gezet; dat duurt een paar minuten.</p>
        )}
        {saved && !updatePending && <p className="text-sm text-green-700">Opgeslagen.</p>}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-gray-50"
        >
          Aanpassen
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => run("save", e)} className="space-y-4">
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-amber-900">
        <div className="text-[15px] font-semibold">
          {writeForMe && !article?.body ? "Artikel schrijven" : isLink ? "Link aanpassen" : "Artikel aanpassen"}
        </div>
        <p className="mt-0.5 text-[13px]">
          {live
            ? `Staat al live. Na opslaan past de site het ${what} binnen een paar minuten aan. Alleen jij kunt dit wijzigen.`
            : canPublish
              ? `Controleer het ${what} en pas aan wat nodig is. Daarna klik je op Publiceren.`
              : `Controleer het ${what} en pas aan wat nodig is.`}
        </p>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

      {isLink ? (
        <>
          <div>
            <label className="mb-1 block text-sm text-ink" htmlFor="editAnchorText">
              Ankertekst (de tekst van de link)
            </label>
            <input
              id="editAnchorText"
              required
              maxLength={200}
              value={anchorText}
              onChange={(e) => setAnchorText(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-ink" htmlFor="editTargetUrl">
              Doel-URL
            </label>
            <input
              id="editTargetUrl"
              type="url"
              required
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://..."
              className={inputClass}
            />
          </div>
          <div>
            <span className="mb-1 block text-sm text-ink">Type link</span>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-1.5">
                <input type="radio" checked={!nofollow} onChange={() => setNofollow(false)} /> Dofollow
              </label>
              <label className="flex items-center gap-1.5">
                <input type="radio" checked={nofollow} onChange={() => setNofollow(true)} /> Nofollow
              </label>
            </div>
          </div>
        </>
      ) : (
        <>
          {writeForMe && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleWrite}
                disabled={!aiEnabled || busy !== ""}
                title={aiEnabled ? undefined : "Zet OPENAI_API_KEY in Railway om dit aan te zetten"}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm text-ink hover:bg-gray-50 disabled:opacity-50"
              >
                <Sparkles size={15} />
                {busy === "write" ? "AI schrijft… (± 30 sec)" : hasText ? "Opnieuw schrijven met AI" : "Schrijf met AI"}
              </button>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm text-ink" htmlFor="editTitle">
              Titel
            </label>
            <input
              id="editTitle"
              required
              maxLength={TITLE_MAX_LENGTH}
              value={title}
              onChange={(e) => changeTitle(e.target.value)}
              className={inputClass}
            />
            <div className="mt-1 text-right text-xs tabular-nums text-inkSoft">
              {title.length}/{TITLE_MAX_LENGTH}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm text-ink" htmlFor="editSlug">
              Permalink (URL na plaatsing)
            </label>
            <div className="flex overflow-hidden rounded-lg border border-line focus-within:ring-2 focus-within:ring-[var(--btn-pay-bg)]">
              {urlPrefix && (
                <span className="hidden max-w-[45%] shrink-0 truncate border-r border-line bg-gray-50 px-3 py-2 text-sm text-inkSoft sm:block">
                  {urlPrefix}
                </span>
              )}
              <input
                id="editSlug"
                value={slug}
                maxLength={190}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSlugTouched(true);
                }}
                onBlur={() => setSlug((s) => wpSlugify(s) || wpSlugify(title))}
                className="min-w-0 flex-1 px-3 py-2 text-sm focus:outline-none"
              />
            </div>
            <p className="mt-1 text-xs text-inkSoft">
              {live && slug !== initialSlug
                ? "De oude link stuurt bezoekers vanzelf door naar de nieuwe."
                : urlPrefix
                  ? "Wordt vanzelf gemaakt uit de titel; je kunt hem korter maken."
                  : "Het laatste deel van de URL. Op deze site staat er nog een deel voor, zoals de categorie."}
            </p>
          </div>

          <div>
            <span className="mb-1 block text-sm text-ink">Tekst</span>
            <RichTextEditor value={body} onChange={setBody} />
            {writeForMe && links.length > 0 && (
              <ul className="mt-2 space-y-0.5 text-xs">
                {links.map((l) => {
                  const ok = hasLink(body, l.url);
                  return (
                    <li key={l.url} className={`flex items-center gap-1.5 ${ok ? "text-green-700" : "text-amber-700"}`}>
                      {ok ? <Check size={13} /> : <X size={13} />}
                      <span>
                        &ldquo;{l.anchor}&rdquo; → {l.url} {ok ? "staat erin" : "staat nog niet in de tekst"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div>
            <span className="mb-1 block text-sm text-ink">Afbeelding</span>
            {imageKey && !choosingImage ? (
              <div className="flex items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/article-images/${imageKey}`}
                  alt=""
                  className="h-20 w-32 shrink-0 rounded-md border border-line object-cover"
                />
                <div className="flex flex-col items-start gap-1 text-sm">
                  <button type="button" onClick={() => setChoosingImage(true)} className="text-[var(--btn-pay-bg)] hover:underline">
                    Andere afbeelding kiezen
                  </button>
                  <button type="button" onClick={() => setImageKey("")} className="text-red-600 hover:underline">
                    Verwijderen
                  </button>
                </div>
              </div>
            ) : photoSearchEnabled ? (
              <>
                <PhotoPicker
                  onPicked={(key) => {
                    setImageKey(key);
                    setChoosingImage(false);
                  }}
                />
                {imageKey && (
                  <button
                    type="button"
                    onClick={() => setChoosingImage(false)}
                    className="mt-3 text-sm text-inkSoft hover:text-ink hover:underline"
                  >
                    Annuleren — huidige afbeelding houden
                  </button>
                )}
              </>
            ) : (
              <p className="text-xs text-inkSoft">Foto&apos;s zoeken staat uit (PIXABAY_API_KEY ontbreekt).</p>
            )}
          </div>
        </>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {dirty ? (
          <span className="mr-auto text-xs text-inkSoft">Niet opgeslagen wijzigingen</span>
        ) : saved ? (
          <span className="mr-auto text-xs text-green-700">Opgeslagen</span>
        ) : null}
        {live ? (
          <>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-3 py-2 text-sm text-inkSoft hover:text-ink"
            >
              Annuleren
            </button>
            <button
              type="submit"
              disabled={busy !== ""}
              className="btn-pay rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
            >
              {busy === "save" ? "Bezig…" : "Opslaan en bijwerken op de site"}
            </button>
          </>
        ) : (
          <>
            <button
              type="submit"
              disabled={busy !== ""}
              className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-gray-50 disabled:opacity-60"
            >
              {busy === "save" ? "Opslaan…" : "Opslaan"}
            </button>
            {canPublish && (
              <button
                type="button"
                onClick={() => run("publish")}
                disabled={busy !== ""}
                className="btn-pay rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
              >
                {busy === "publish" ? "Bezig…" : "Publiceren"}
              </button>
            )}
          </>
        )}
      </div>
    </form>
  );
}
