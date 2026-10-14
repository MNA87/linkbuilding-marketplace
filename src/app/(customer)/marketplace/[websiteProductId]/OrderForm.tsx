"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createOrderSchema } from "@/lib/validations/order";
import { addToCartAction, updateCartItemContentAction } from "./actions";
import RichTextEditor, { normalizeLinkUrl } from "@/components/RichTextEditor";
import { fillBlogUrl } from "@/lib/wpSlug";
import { TITLE_MAX_LENGTH } from "@/lib/validations/order";
import FormActions, { goesToCart } from "./FormActions";
import PhotoPicker from "@/components/PhotoPicker";
import PlacementOptions from "./PlacementOptions";
import { reportInvalidInDutch, showErrorBox } from "@/lib/formValidation";
import { DEFAULT_DURATION_YEARS, sanitizePlacementChoice } from "@/lib/placementPeriod";
import type { BriefLink } from "@/lib/writingService";

type ArticleMode = "text" | "googledoc" | "later";

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
  // How "Zelf schrijven" is delivered: typed here, a Google Doc link, or later.
  articleMode: ArticleMode;
  articleDocUrl: string;
  docPublicConfirm: boolean;
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
  articleMode: "text",
  articleDocUrl: "",
  docPublicConfirm: false,
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

function draftHasContent(d: Draft): boolean {
  return Boolean(
    d.articleTitle.trim() ||
      d.articleBody.replace(/<[^>]*>/g, "").trim() ||
      linkRows(d.briefLinks).some((l) => l.anchor.trim() || l.url.trim())
  );
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
  freshAdd = false,
  backHref,
  siteDomain,
  nextHref,
  initialDraft,
  initialImageKey,
  photoSearchEnabled,
  yearlyPrice,
  periodic,
  scheduleMin,
  scheduleMax,
  writingPrice,
  nicheOptions = [],
  currentTopicId = "",
  headerDomain,
  productLabel,
  paid = false,
}: {
  websiteProductId: string;
  wpCategories: { id: string; name: string }[];
  // The niches (topics) this site offers, with the price per year for each,
  // so the popup can prefill the niche and re-price when it's changed.
  nicheOptions?: { id: string; name: string; yearly: number }[];
  currentTopicId?: string;
  // In the popup the domain rides in the slim top bar (no big heading above).
  headerDomain?: string;
  productLabel?: string;
  blogUrlTemplate: string | null;
  orderItemId?: string;
  // A just-added item (already in the cart as "Actie nodig").
  freshAdd?: boolean;
  backHref: string;
  // The site's domain, to name it in the "added to cart" confirmation.
  siteDomain: string;
  // Filling in several cart items in a row: where "Opslaan" goes next.
  nextHref?: string;
  initialDraft?: Draft;
  initialImageKey?: string;
  photoSearchEnabled: boolean;
  yearlyPrice: number;
  // "Per jaar" on this site: the customer picks 1-3 years.
  periodic: boolean;
  scheduleMin: string;
  scheduleMax: string;
  writingPrice: number;
  // Paid for before it was filled in: only the content is sent in now.
  paid?: boolean;
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

  // The chosen niche, prefilled from the marketplace filter. Changing it can
  // change the price, which we show live here and re-check server-side. A paid
  // item's niche/price is fixed.
  const [topicId, setTopicId] = useState(currentTopicId);
  const nicheLocked = paid;
  const selectedNiche = nicheOptions.find((n) => n.id === topicId);
  const effYearly = selectedNiche?.yearly ?? yearlyPrice;
  // The price shown at the top moves with the choices: the niche/period, plus
  // the writing fee when "Laat ons schrijven" is picked — so one price always
  // matches what ends up in the cart (no separate "+ €25" line to add up).
  const basePrice = effYearly * (periodic ? draft.durationYears : 1);
  const writingAdds = draft.writeForMe && writingPrice > 0;
  const totalPrice = basePrice + (writingAdds ? writingPrice : 0);

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
        // Everything cleared but never saved (saving an empty item is
        // refused): the saved article is still what counts, so show that.
        if (!draftHasContent(restored) && initialDraft && draftHasContent(initialDraft)) return;
        setDraft({
          ...restored,
          // Paid: the choice was part of the price, whatever was typed before.
          writeForMe: paid ? initialDraft?.writeForMe === true : restored.writeForMe === true,
          briefLinks: linkRows(restored.briefLinks),
          ...sanitizePlacementChoice(restored, { min: scheduleMin, max: scheduleMax }),
        });
      }
    } catch {
      // Corrupt or inaccessible storage — just start from a blank form.
    }
    // Only on opening the form, not on every change of the props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const toCart = goesToCart(e);
    setError(null);

    const { wpCategoryId, articleTitle, articleBody, comments, publishOn, durationYears, writeForMe } = draft;
    // An image only rides along with a typed article; the writing service and
    // a Google Doc / "later" delivery pick/need none here.
    const typingSelf = !writeForMe && draft.articleMode === "text";
    const articleImageKey = typingSelf ? existingImageKey : "";
    const briefLinks = draft.briefLinks.map((l) => ({ anchor: l.anchor.trim(), url: normalizeLinkUrl(l.url) }));
    if (writeForMe) set("briefLinks", briefLinks);
    const content = {
      topicId,
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
      articleMode: draft.articleMode,
      articleDocUrl: draft.articleMode === "googledoc" ? draft.articleDocUrl.trim() : "",
      docPublicConfirm: draft.articleMode === "googledoc" ? draft.docPublicConfirm : false,
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
      if (paid) {
        router.push(nextHref ?? `/dashboard/orders/${result.orderId}?ingevuld=1`);
        router.refresh();
      } else if (toCart) {
        // Step 3 (Afrekenen) lives in the cart — go there to pay.
        router.push("/dashboard/cart");
        router.refresh();
      } else if (nextHref) {
        // Filling in several cart items in a row: on to the next one.
        router.push(nextHref);
        // Refresh so the cart count in the top bar / menu goes up right away.
        router.refresh();
      } else {
        // Back where they came from — the marketplace for a fresh pick (so
        // they can keep browsing), or the cart when editing from there —
        // with a confirmation naming the site they just added.
        const sep = backHref.includes("?") ? "&" : "?";
        router.push(`${backHref}${sep}toegevoegd=${encodeURIComponent(siteDomain)}`);
        // Refresh so the cart count (top bar / menu) and the row's "in cart"
        // state update immediately, not only after a manual page refresh.
        router.refresh();
      }
    } catch {
      setError("Er ging iets mis. Probeer het opnieuw.");
      setLoading(false);
    }
  }

  const writingPriceLabel = writingPrice > 0 ? `+ €${writingPrice.toFixed(2)}` : "Inbegrepen";
  const inputClass =
    "w-full border border-line rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand";
  const previewUrl = blogUrlTemplate ? fillBlogUrl(blogUrlTemplate, draft.articleTitle) : null;
  // The three "who writes it" tiles: deliver it yourself (type or Google Doc),
  // let us write it, or fill it in later.
  const selfDeliver = !draft.writeForMe && draft.articleMode !== "later";
  const later = !draft.writeForMe && draft.articleMode === "later";
  const tileClass = (active: boolean) =>
    `rounded-lg border px-4 py-3 text-left transition-colors ${
      active ? "border-brand bg-brandSoft" : "border-line hover:border-inkSoft"
    } disabled:opacity-40 disabled:hover:border-line`;

  return (
    <form
      onSubmit={handleSubmit}
      // A field the browser refuses (e.g. a required one left empty) would
      // otherwise only get a small bubble, or nothing at all if it's out of
      // view — say why nothing was saved, next to the buttons too.
      onInvalidCapture={(e) => reportInvalidInDutch(e, setError)}
      className="space-y-4"
    >
      <div className="space-y-4 bg-surface border border-line rounded-lg p-5 min-w-0">
        {error && (
          <div ref={showErrorBox} className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        {/* Header = facts only: the website + what it is on the left, the price
            on the right (black). The niche is a choice, so it sits below. */}
        <div className="flex items-start justify-between gap-4 border-b border-line pb-4">
          <div className="min-w-0">
            {headerDomain ? (
              <>
                <div className="text-lg font-semibold text-ink">{headerDomain}</div>
                {productLabel && <div className="mt-0.5 text-xs text-inkSoft">{productLabel}</div>}
              </>
            ) : (
              <span />
            )}
          </div>
          <div className="shrink-0 text-right">
            <span className="block text-xl font-semibold text-ink tabular-nums">
              € {totalPrice.toLocaleString("nl-NL")}
            </span>
            {writingAdds && (
              <span className="mt-0.5 block text-xs text-inkSoft tabular-nums">
                incl. € {writingPrice.toLocaleString("nl-NL")} schrijven
              </span>
            )}
          </div>
        </div>

        {/* Niche changes the price, so it lives with the fields — compact and
            inline, not a full-width control. */}
        {nicheOptions.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-ink" htmlFor="nicheTopic">
              Niche
            </label>
            <select
              id="nicheTopic"
              value={topicId}
              disabled={nicheLocked}
              onChange={(e) => setTopicId(e.target.value)}
              className="rounded-md border border-line bg-white px-2.5 py-1.5 text-sm font-medium text-ink focus:outline-none focus:ring-2 focus:ring-brand disabled:bg-gray-100 disabled:text-inkSoft"
            >
              {nicheOptions.map((n) => (
                <option key={n.id || "algemeen"} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {wpCategories.length > 0 && (
          <div>
            <label className="block text-sm text-ink mb-1" htmlFor="wpCategoryId">
              Categorie op de site
            </label>
            <select
              id="wpCategoryId"
              // "Later aanleveren" defers all content, so don't force a category now.
              required={!later}
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
          <span className="block text-sm text-ink mb-1">
            Wie schrijft dit artikel?
            {paid && <span className="ml-1.5 text-xs text-inkSoft">· gekozen bij het bestellen</span>}
          </span>
          <div role="radiogroup" aria-label="Wie schrijft dit artikel?" className="grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              role="radio"
              aria-checked={selfDeliver}
              disabled={paid && draft.writeForMe}
              onClick={() => {
                set("writeForMe", false);
                if (draft.articleMode === "later") set("articleMode", "text");
              }}
              className={tileClass(selfDeliver)}
            >
              <span className="text-sm font-medium text-ink">Zelf aanleveren</span>
              <span className="block text-xs text-inkSoft mt-0.5">Tekst typen of een Google Doc-link.</span>
              <span className="mt-1.5 block text-xs font-semibold text-brand">Inbegrepen</span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={draft.writeForMe}
              disabled={paid && !draft.writeForMe}
              onClick={() => set("writeForMe", true)}
              className={tileClass(draft.writeForMe)}
            >
              <span className="text-sm font-medium text-ink">Laat ons schrijven</span>
              <span className="block text-xs text-inkSoft mt-0.5">Jij geeft je links, wij schrijven het.</span>
              <span className="mt-1.5 block text-xs font-semibold text-ink">
                {paid && draft.writeForMe ? "Gekozen" : writingPriceLabel}
              </span>
            </button>
            {/* "Later aanleveren" — not for a paid item (it already needs content). */}
            {!paid && (
              <button
                type="button"
                role="radio"
                aria-checked={later}
                onClick={() => {
                  set("writeForMe", false);
                  set("articleMode", "later");
                }}
                className={tileClass(later)}
              >
                <span className="text-sm font-medium text-ink">Later aanleveren</span>
                <span className="block text-xs text-inkSoft mt-0.5">Nu afrekenen, later invullen.</span>
                <span className="mt-1.5 block text-xs font-semibold text-brand">Inbegrepen</span>
              </button>
            )}
          </div>
        </div>

        {/* Zelf aanleveren: type the article here, or paste a Google Doc link. */}
        {selfDeliver && (
          <div className="inline-flex gap-1 rounded-lg bg-gray-100 p-1">
            {(
              [
                ["text", "Tekst typen"],
                ["googledoc", "Google Doc-link"],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => set("articleMode", mode)}
                className={`rounded-md px-3.5 py-1.5 text-sm transition-colors ${
                  draft.articleMode === mode ? "bg-surface text-ink font-medium shadow-sm" : "text-inkSoft hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {!draft.writeForMe && draft.articleMode === "googledoc" && (
          <div>
            <label className="block text-sm text-ink mb-1" htmlFor="articleDocUrl">
              Google Doc-link
            </label>
            <input
              id="articleDocUrl"
              type="text"
              inputMode="url"
              placeholder="https://docs.google.com/document/d/…"
              value={draft.articleDocUrl}
              onChange={(e) => set("articleDocUrl", e.target.value)}
              className={inputClass}
            />
            <label className="mt-2 flex items-start gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={draft.docPublicConfirm}
                onChange={(e) => set("docPublicConfirm", e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--btn-pay-bg)]"
              />
              <span>
                Ik bevestig dat dit document gedeeld is met &ldquo;iedereen met de link kan bekijken&rdquo;, zodat wij het
                kunnen openen.
              </span>
            </label>
          </div>
        )}

        {!draft.writeForMe && draft.articleMode === "later" && (
          <p className="rounded-lg border border-line bg-gray-50 px-4 py-3 text-sm text-inkSoft">
            Je rekent nu af en levert het artikel later aan. Je vindt deze link daarna onder{" "}
            <span className="font-medium text-ink">Mijn orders</span> met de knop{" "}
            <span className="font-medium text-ink">Nu invullen</span>.
          </p>
        )}

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

        {/* Own article (typed here): kept mounted (only hidden) when another
            delivery/article choice is active, so switching back loses nothing. */}
        <div className={!draft.writeForMe && draft.articleMode === "text" ? "space-y-4" : "hidden"}>
          <div>
            <label className="block text-sm text-ink mb-1" htmlFor="articleTitle">
              Titel
            </label>
            <input
              id="articleTitle"
              // Only required when this field is actually shown. Hidden-but-required
              // (Google Doc / "later") would make the browser block submit with an
              // unfocusable field — nothing checks out and "vul Titel in" pops up.
              required={!draft.writeForMe && draft.articleMode === "text"}
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

      {/* "Later aanleveren": the customer only pays now, so don't ask when it
          goes online — that's chosen later, when they fill the article in. */}
      {!later && (
        <div className="bg-surface border border-line rounded-lg p-5">
          <PlacementOptions
            publishOn={draft.publishOn}
            durationYears={draft.durationYears}
            onPublishOnChange={(value) => set("publishOn", value)}
            onDurationYearsChange={(value) => set("durationYears", value)}
            yearlyPrice={effYearly}
            scheduleMin={scheduleMin}
            scheduleMax={scheduleMax}
            inputClass={inputClass}
            directNote={
              draft.writeForMe
                ? "Gaat online zodra wij het artikel hebben geschreven en gecontroleerd."
                : paid
                  ? "Gaat online zodra je het verstuurt en wij het hebben gecontroleerd."
                  : undefined
            }
            // Paid: the period was part of the price.
            showPeriod={periodic && !paid}
          />
          {/* No "Artikel schrijven + €25" line here anymore: the writing fee is
              already in the price at the top ("incl. € 25 schrijven"), so one
              price is all the customer has to read. */}
        </div>
      )}

      <div className="bg-surface border border-line rounded-lg px-5 py-4">
        <FormActions
          separator={false}
          loading={loading || uploadingImage}
          editing={editing}
          freshAdd={freshAdd}
          nextInSequence={Boolean(nextHref)}
          paid={paid}
          backHref={backHref}
        />
      </div>
    </form>
  );
}
