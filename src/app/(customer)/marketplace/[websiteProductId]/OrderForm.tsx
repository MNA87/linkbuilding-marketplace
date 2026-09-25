"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createOrderSchema } from "@/lib/validations/order";
import { addToCartAction, updateCartItemContentAction } from "./actions";
import RichTextEditor, { normalizeLinkUrl } from "@/components/RichTextEditor";
import { fillBlogUrl } from "@/lib/wpSlug";
import { TITLE_MAX_LENGTH } from "@/lib/validations/order";
import FormActions, { wantsToPay } from "./FormActions";
import PhotoPicker from "@/components/PhotoPicker";
import { goToCheckout } from "../../dashboard/cart/goToCheckout";
import PlacementOptions from "./PlacementOptions";
import { reportInvalidInDutch, showErrorBox } from "@/lib/formValidation";
import { DEFAULT_DURATION_YEARS, hasPeriod, sanitizePlacementChoice } from "@/lib/placementPeriod";
import type { BriefLink } from "@/lib/writingService";

type Draft = {
  wpCategoryId: string;
  articleTitle: string;
  articleBody: string;
  comments: string;
  publishOn: string;
  durationYears: number;
  // "Laat ons schrijven": we write the article around the customer's links.
  writeForMe: boolean;
  briefLinks: BriefLink[];
};

const EMPTY_LINKS: BriefLink[] = [
  { anchor: "", url: "" },
  { anchor: "", url: "" },
];

const EMPTY_DRAFT: Draft = {
  wpCategoryId: "",
  articleTitle: "",
  articleBody: "",
  comments: "",
  publishOn: "",
  durationYears: DEFAULT_DURATION_YEARS,
  writeForMe: false,
  briefLinks: EMPTY_LINKS,
};

// Always exactly two link rows, whatever a saved draft held.
function linkRows(links: unknown): BriefLink[] {
  const list = Array.isArray(links) ? links : [];
  return EMPTY_LINKS.map((empty, i) => {
    const l = list[i] as Partial<BriefLink> | undefined;
    return {
      anchor: typeof l?.anchor === "string" ? l.anchor : empty.anchor,
      url: typeof l?.url === "string" ? l.url : empty.url,
    };
  });
}

// Uploading an own image is switched off for now — only Pixabay photos.
// Flip back to true to bring the "Eigen afbeelding" tab back.
const OWN_IMAGE_UPLOAD_ENABLED = false;

function draftKey(key: string): string {
  return `nugevonden-order-draft-${key}`;
}

function imageDraftKey(key: string): string {
  return `nugevonden-order-image-${key}`;
}

const IMAGE_KEY_PATTERN = /^[0-9a-f-]{36}\.(png|jpg|jpeg|webp|gif)$/i;

export default function OrderForm({
  websiteProductId,
  wpCategories,
  blogUrlTemplate,
  orderItemId,
  discardOrderItemId,
  backHref,
  nextHref,
  initialDraft,
  initialImageKey,
  photoSearchEnabled,
  yearlyPrice,
  scheduleMin,
  scheduleMax,
  writingPrice,
}: {
  websiteProductId: string;
  wpCategories: { id: string; name: string }[];
  blogUrlTemplate: string | null;
  orderItemId?: string;
  discardOrderItemId?: string;
  backHref: string;
  // Filling in several cart items in a row: where "Opslaan" goes next.
  nextHref?: string;
  initialDraft?: Draft;
  initialImageKey?: string;
  photoSearchEnabled: boolean;
  yearlyPrice: number;
  scheduleMin: string;
  scheduleMax: string;
  writingPrice: number;
}) {
  const router = useRouter();
  const editing = Boolean(orderItemId);
  // An item already in the cart (editing) keys its own local draft by
  // orderItemId, separate from the "add new" draft for this same product —
  // otherwise filling in one would silently overwrite the other's autosave.
  const storageKey = orderItemId ?? websiteProductId;
  const [draft, setDraft] = useState<Draft>(() => {
    const initial = { ...EMPTY_DRAFT, ...initialDraft };
    return { ...initial, briefLinks: linkRows(initial.briefLinks) };
  });
  const [existingImageKey, setExistingImageKey] = useState(initialImageKey ?? "");
  const [uploadingImage, setUploadingImage] = useState(false);
  // Photo search is the default; an item that already has an image opens
  // on that image instead, since it may have been the customer's own upload.
  const [imageTab, setImageTab] = useState<"upload" | "search">(
    photoSearchEnabled && (!initialImageKey || !OWN_IMAGE_UPLOAD_ENABLED) ? "search" : "upload"
  );
  const showUpload = OWN_IMAGE_UPLOAD_ENABLED;
  const showSearch = photoSearchEnabled;
  // After an image is chosen the picker folds away; "Andere afbeelding
  // kiezen" opens it again.
  const [choosingImage, setChoosingImage] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(
    initialImageKey ? `/api/article-images/${initialImageKey}` : null
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Restore a draft the customer left behind (e.g. an accidental refresh —
  // easy to trigger by mistake on mobile with pull-to-refresh) — read after
  // mount, not as the initial state, so server and first client render still
  // match and React doesn't complain about a hydration mismatch. This also
  // applies when editing an already-in-cart item: initialDraft is only what
  // was last actually saved to the server, so a local draft (unsaved typing
  // since then) is the more recent version and should win.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(draftKey(storageKey));
      if (saved) {
        const restored = { ...EMPTY_DRAFT, ...JSON.parse(saved) };
        setDraft({
          ...restored,
          writeForMe: restored.writeForMe === true,
          briefLinks: linkRows(restored.briefLinks),
          ...sanitizePlacementChoice(restored, { min: scheduleMin, max: scheduleMax }),
        });
      }
    } catch {
      // Corrupt or inaccessible storage — just start from a blank form.
    }
  }, [storageKey, scheduleMin, scheduleMax]);

  useEffect(() => {
    try {
      window.localStorage.setItem(draftKey(storageKey), JSON.stringify(draft));
    } catch {
      // Storage full/blocked — losing autosave isn't worth surfacing an error for.
    }
  }, [draft, storageKey]);

  // The chosen image survives a refresh too. Only an already-stored image
  // key is kept (both a Pixabay pick and an own file are stored the moment
  // they're chosen), so there's never a half-uploaded file to restore.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(imageDraftKey(storageKey));
      if (!saved) return;
      const { key } = JSON.parse(saved) as { key?: string };
      if (key === "") {
        setExistingImageKey("");
        setImagePreviewUrl(null);
      } else if (typeof key === "string" && IMAGE_KEY_PATTERN.test(key)) {
        setExistingImageKey(key);
        setImagePreviewUrl(`/api/article-images/${key}`);
      }
    } catch {
      // Corrupt or inaccessible storage — keep whatever the server had.
    }
  }, [storageKey]);

  function rememberImage(key: string) {
    try {
      window.localStorage.setItem(imageDraftKey(storageKey), JSON.stringify({ key }));
    } catch {
      // Storage full/blocked — the image is still saved with the order itself.
    }
  }

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function setLink(index: number, field: keyof BriefLink, value: string) {
    setDraft((d) => ({
      ...d,
      briefLinks: d.briefLinks.map((l, i) => (i === index ? { ...l, [field]: value } : l)),
    }));
  }

  function clearDraft() {
    try {
      window.localStorage.removeItem(draftKey(storageKey));
      window.localStorage.removeItem(imageDraftKey(storageKey));
    } catch {
      // Nothing to clean up if storage isn't available.
    }
  }

  function selectImage(key: string) {
    setExistingImageKey(key);
    setImagePreviewUrl(key ? `/api/article-images/${key}` : null);
    setChoosingImage(false);
    rememberImage(key);
  }

  // Uploaded right away (not on save), so it survives a refresh just like
  // a picked Pixabay photo does.
  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setError(null);
    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.set("file", selected);
      const res = await fetch("/api/upload/article-image", { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Uploaden van afbeelding mislukt.");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      selectImage(body.key);
    } catch {
      setError("Uploaden van afbeelding mislukt. Probeer het opnieuw.");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      setUploadingImage(false);
    }
  }

  function handlePhotoPicked(key: string) {
    selectImage(key);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleRemoveImage() {
    selectImage("");
    // Clears the browser's own memory of the chosen file too — otherwise
    // picking the exact same file again wouldn't even fire a change event.
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const pay = wantsToPay(e);
    setError(null);

    const { wpCategoryId, articleTitle, articleBody, comments, publishOn, durationYears, writeForMe } = draft;
    // We pick the image ourselves when we write the article.
    const articleImageKey = writeForMe ? "" : existingImageKey;
    const briefLinks = draft.briefLinks.map((l) => ({ anchor: l.anchor.trim(), url: normalizeLinkUrl(l.url) }));
    if (writeForMe) set("briefLinks", briefLinks);
    const content = {
      // A category left over in a saved draft must not tag along once the
      // field isn't shown for this site anymore.
      wpCategoryId: wpCategories.length > 0 ? wpCategoryId : "",
      articleTitle,
      articleBody,
      comments,
      // Links in blog articles are always dofollow — no choice offered.
      nofollow: false,
      publishOn,
      durationYears,
      writeForMe,
      briefLinks: writeForMe ? briefLinks : [],
    };
    const input = { websiteProductId, ...content, articleImageKey };

    let parsed: ReturnType<typeof createOrderSchema.safeParse>;
    try {
      parsed = createOrderSchema.safeParse(input);
    } catch {
      // Never let a check that trips over itself end in "nothing happens":
      // the server validates everything again anyway.
      parsed = { success: true, data: input } as ReturnType<typeof createOrderSchema.safeParse>;
    }
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Ongeldige invoer");
      return;
    }

    setLoading(true);
    try {
      const result = editing
        ? await updateCartItemContentAction({ orderItemId, ...content, articleImageKey })
        : await addToCartAction(input);
      if (!result.success) {
        setError(result.error ?? "Er ging iets mis.");
        setLoading(false);
        return;
      }
      clearDraft();
      if (pay && result.orderId) {
        await goToCheckout(result.orderId, router.push);
      } else {
        router.push(nextHref ?? "/dashboard/cart");
      }
    } catch {
      setError("Er ging iets mis. Probeer het opnieuw.");
      setLoading(false);
    }
  }

  const writingPriceLabel = writingPrice > 0 ? `+ €${writingPrice.toFixed(2)}` : "Gratis";
  const inputClass =
    "w-full border border-line rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand";
  const previewUrl = blogUrlTemplate ? fillBlogUrl(blogUrlTemplate, draft.articleTitle) : null;

  return (
    <form
      onSubmit={handleSubmit}
      // A field the browser refuses (e.g. a required one left empty) would
      // otherwise only get a small bubble, or nothing at all if it's out of
      // view — say why nothing was saved, next to the buttons too.
      onInvalidCapture={(e) => reportInvalidInDutch(e, setError)}
      className="grid gap-6 items-start lg:grid-cols-[minmax(0,1fr)_17rem]"
    >
      <div className="space-y-4 bg-surface border border-line rounded-lg p-6 min-w-0 lg:col-start-1 lg:row-start-1">
        {error && (
          <div ref={showErrorBox} className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        {wpCategories.length > 0 && (
          <div>
            <label className="block text-sm text-ink mb-1" htmlFor="wpCategoryId">
              Categorie op de site
            </label>
            <select
              id="wpCategoryId"
              required
              value={draft.wpCategoryId}
              onChange={(e) => set("wpCategoryId", e.target.value)}
              className={inputClass}
            >
              <option value="" disabled>
                Kies een categorie...
              </option>
              {wpCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <span className="block text-sm text-ink mb-1">Het artikel</span>
          <div role="radiogroup" aria-label="Het artikel" className="grid gap-2 sm:grid-cols-2">
            {(
              [
                [false, "Zelf schrijven", "Je levert zelf de titel en tekst aan.", "Inbegrepen"],
                [true, "Laat ons schrijven", "Jij geeft je links, wij schrijven het artikel.", writingPriceLabel],
              ] as const
            ).map(([value, title, text, price]) => {
              const active = draft.writeForMe === value;
              return (
                <button
                  key={title}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => set("writeForMe", value)}
                  className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                    active ? "border-brand bg-brandSoft" : "border-line hover:border-inkSoft"
                  }`}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-ink">{title}</span>
                    <span className={`text-xs tabular-nums ${value ? "text-ink" : "text-inkSoft"}`}>{price}</span>
                  </span>
                  <span className="block text-xs text-inkSoft mt-0.5">{text}</span>
                </button>
              );
            })}
          </div>
        </div>

        {draft.writeForMe && (
          <div className="space-y-4">
            {draft.briefLinks.map((link, i) => (
              <fieldset key={i}>
                <legend className="text-sm text-ink mb-1">
                  Link {i + 1} {i > 0 && <span className="text-inkSoft">(optioneel)</span>}
                </legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    aria-label={`Ankertekst link ${i + 1}`}
                    required={i === 0 || Boolean(link.url.trim())}
                    maxLength={120}
                    placeholder="Ankertekst, bijv. duurzame tuinmeubelen"
                    value={link.anchor}
                    onChange={(e) => setLink(i, "anchor", e.target.value)}
                    className={inputClass}
                  />
                  <input
                    aria-label={`URL link ${i + 1}`}
                    type="text"
                    inputMode="url"
                    required={i === 0 || Boolean(link.anchor.trim())}
                    placeholder="https://jouwsite.nl/pagina"
                    value={link.url}
                    onChange={(e) => setLink(i, "url", e.target.value)}
                    onBlur={(e) => setLink(i, "url", normalizeLinkUrl(e.target.value))}
                    className={inputClass}
                  />
                </div>
              </fieldset>
            ))}
            <p className="text-xs text-inkSoft">
              Wij schrijven een passend artikel met {draft.briefLinks[1].anchor.trim() ? "deze links" : "deze link"}, kiezen
              er een afbeelding bij en zetten het online. Je hoeft verder niets te doen.
            </p>
          </div>
        )}

        {/* Own article: kept mounted (only hidden) while "Laat ons schrijven"
            is chosen, so switching back loses nothing. */}
        <div className={draft.writeForMe ? "hidden" : "space-y-4"}>
          <div>
            <label className="block text-sm text-ink mb-1" htmlFor="articleTitle">
              Titel
            </label>
            <input
              id="articleTitle"
              required={!draft.writeForMe}
              maxLength={TITLE_MAX_LENGTH}
              placeholder="Waar gaat het artikel over?"
              value={draft.articleTitle}
              onChange={(e) => set("articleTitle", e.target.value)}
              className={inputClass}
            />
            <div className="flex items-start justify-between gap-3 mt-1 text-xs text-inkSoft">
              {blogUrlTemplate ? (
                <p className="break-all">
                  Je blog-URL na plaatsing:{" "}
                  {previewUrl ? (
                    <span className="text-ink">{previewUrl}</span>
                  ) : (
                    <span className="italic">vul een titel in om de URL te zien</span>
                  )}
                </p>
              ) : (
                <span />
              )}
              <span className={`shrink-0 tabular-nums ${draft.articleTitle.length > TITLE_MAX_LENGTH ? "text-red-600" : ""}`}>
                {draft.articleTitle.length}/{TITLE_MAX_LENGTH}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm text-ink mb-1">Tekst</label>
            <RichTextEditor
              value={draft.articleBody}
              onChange={(value) => set("articleBody", value)}
            />
          </div>

          <div className={showUpload || showSearch || imagePreviewUrl ? "" : "hidden"}>
            <span className="block text-sm text-ink mb-1">Afbeelding</span>
            {imagePreviewUrl && !choosingImage && (
              <div className="flex items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagePreviewUrl} alt="" className="h-20 w-32 shrink-0 rounded-md border border-line object-cover" />
                <div className="flex flex-col items-start gap-1 text-sm">
                  <button type="button" onClick={() => setChoosingImage(true)} className="text-brand hover:underline">
                    Andere afbeelding kiezen
                  </button>
                  <button type="button" onClick={handleRemoveImage} className="text-red-600 hover:underline">
                    Verwijderen
                  </button>
                </div>
              </div>
            )}
            {/* Kept mounted (only hidden) so the search term, results and a
                selected file survive folding the picker away and back. */}
            <div className={!imagePreviewUrl || choosingImage ? "" : "hidden"}>
              {showUpload && showSearch && (
                <div className="flex gap-1 border-b border-line mb-3">
                  {(
                    [
                      ["search", "Zoek een foto"],
                      ["upload", "Eigen afbeelding"],
                    ] as const
                  ).map(([tab, label]) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setImageTab(tab)}
                      className={`px-3 py-1.5 text-sm border-b-2 -mb-px transition-colors ${
                        imageTab === tab ? "border-brand text-brand font-medium" : "border-transparent text-inkSoft hover:text-ink"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
              <div className={showUpload && (imageTab === "upload" || !showSearch) ? "" : "hidden"}>
                <input
                  ref={fileInputRef}
                  id="image"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={handleImageChange}
                  disabled={uploadingImage}
                  className="text-sm"
                />
                <p className="text-xs text-inkSoft mt-1">
                  {uploadingImage ? "Afbeelding uploaden..." : "Max 2MB — PNG, JPG, WEBP of GIF."}
                </p>
              </div>
              {showSearch && (
                <div className={imageTab === "search" || !showUpload ? "" : "hidden"}>
                  <PhotoPicker onPicked={handlePhotoPicked} />
                </div>
              )}
              {imagePreviewUrl && choosingImage && (
                <button
                  type="button"
                  onClick={() => setChoosingImage(false)}
                  className="mt-3 text-sm text-inkSoft hover:text-ink hover:underline"
                >
                  Annuleren — huidige afbeelding houden
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <aside className="bg-surface border border-line rounded-lg p-6 lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-4">
        <PlacementOptions
          publishOn={draft.publishOn}
          durationYears={draft.durationYears}
          onPublishOnChange={(value) => set("publishOn", value)}
          onDurationYearsChange={(value) => set("durationYears", value)}
          yearlyPrice={yearlyPrice}
          scheduleMin={scheduleMin}
          scheduleMax={scheduleMax}
          inputClass={inputClass}
          directNote={draft.writeForMe ? "Gaat online zodra wij het artikel hebben geschreven." : undefined}
          showPeriod={hasPeriod("BLOG_POST")}
        />
        {draft.writeForMe && (
          <p className="mt-5 pt-4 border-t border-line flex justify-between text-sm text-ink">
            <span>Artikel schrijven</span>
            <span className="tabular-nums">{writingPriceLabel}</span>
          </p>
        )}
      </aside>

      <div className="bg-surface border border-line rounded-lg px-6 py-4 lg:col-start-1 lg:row-start-2">
        <FormActions
          separator={false}
          loading={loading || uploadingImage}
          editing={editing}
          discardOrderItemId={discardOrderItemId}
          nextInSequence={Boolean(nextHref)}
          backHref={backHref}
          hasInput={Boolean(
            draft.articleTitle.trim() ||
              draft.articleBody.replace(/<[^>]*>/g, "").trim() ||
              existingImageKey ||
              draft.briefLinks.some((l) => l.anchor.trim() || l.url.trim()),
          )}
          onDiscard={clearDraft}
        />
      </div>
    </form>
  );
}
