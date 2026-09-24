"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createOrderSchema } from "@/lib/validations/order";
import { addToCartAction, updateCartItemContentAction } from "./actions";
import RichTextEditor from "@/components/RichTextEditor";
import { fillBlogUrl } from "@/lib/wpSlug";
import { TITLE_MAX_LENGTH } from "@/lib/validations/order";
import FormActions, { wantsToPay } from "./FormActions";
import { goToCheckout } from "../../dashboard/cart/goToCheckout";

type Draft = {
  wpCategoryId: string;
  articleTitle: string;
  articleBody: string;
  comments: string;
};

const EMPTY_DRAFT: Draft = {
  wpCategoryId: "",
  articleTitle: "",
  articleBody: "",
  comments: "",
};

function draftKey(key: string): string {
  return `nugevonden-order-draft-${key}`;
}

export default function OrderForm({
  websiteProductId,
  price,
  wpCategories,
  blogUrlTemplate,
  orderItemId,
  discardOrderItemId,
  backHref,
  initialDraft,
  initialImageKey,
}: {
  websiteProductId: string;
  price: string;
  wpCategories: { id: string; name: string }[];
  blogUrlTemplate: string | null;
  orderItemId?: string;
  discardOrderItemId?: string;
  backHref: string;
  initialDraft?: Draft;
  initialImageKey?: string;
}) {
  const router = useRouter();
  const editing = Boolean(orderItemId);
  // An item already in the cart (editing) keys its own local draft by
  // orderItemId, separate from the "add new" draft for this same product —
  // otherwise filling in one would silently overwrite the other's autosave.
  const storageKey = orderItemId ?? websiteProductId;
  const [draft, setDraft] = useState<Draft>({ ...EMPTY_DRAFT, ...initialDraft });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [existingImageKey, setExistingImageKey] = useState(initialImageKey ?? "");
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
      if (saved) setDraft({ ...EMPTY_DRAFT, ...JSON.parse(saved) });
    } catch {
      // Corrupt or inaccessible storage — just start from a blank form.
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(draftKey(storageKey), JSON.stringify(draft));
    } catch {
      // Storage full/blocked — losing autosave isn't worth surfacing an error for.
    }
  }, [draft, storageKey]);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function clearDraft() {
    try {
      window.localStorage.removeItem(draftKey(storageKey));
    } catch {
      // Nothing to clean up if storage isn't available.
    }
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setImageFile(selected);
    setExistingImageKey("");
    setImagePreviewUrl((prev) => {
      if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return selected ? URL.createObjectURL(selected) : null;
    });
  }

  function handleRemoveImage() {
    setImageFile(null);
    setExistingImageKey("");
    setImagePreviewUrl((prev) => {
      if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return null;
    });
    // Clears the browser's own memory of the chosen file too — otherwise
    // picking the exact same file again wouldn't even fire a change event.
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const pay = wantsToPay(e);
    setError(null);

    let articleImageKey = existingImageKey;
    if (imageFile) {
      const fd = new FormData();
      fd.set("file", imageFile);
      const res = await fetch("/api/upload/article-image", { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Uploaden van afbeelding mislukt.");
        return;
      }
      articleImageKey = body.key;
    }

    const { wpCategoryId, articleTitle, articleBody, comments } = draft;
    const content = {
      // A category left over in a saved draft must not tag along once the
      // field isn't shown for this site anymore.
      wpCategoryId: wpCategories.length > 0 ? wpCategoryId : "",
      articleTitle,
      articleBody,
      comments,
      // Links in blog articles are always dofollow — no choice offered.
      nofollow: false,
    };
    const input = { websiteProductId, ...content, articleImageKey };

    const parsed = createOrderSchema.safeParse(input);
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
        router.push("/dashboard/cart");
      }
    } catch {
      setError("Er ging iets mis. Probeer het opnieuw.");
      setLoading(false);
    }
  }

  const inputClass =
    "w-full border border-line rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand";
  const previewUrl = blogUrlTemplate ? fillBlogUrl(blogUrlTemplate, draft.articleTitle) : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-surface border border-line rounded-lg p-6">
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>
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
        <label className="block text-sm text-ink mb-1" htmlFor="articleTitle">
          Titel
        </label>
        <input
          id="articleTitle"
          required
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
          placeholder="Schrijf je artikel... wil je een link naar je eigen site? Selecteer een stukje tekst en klik op het link-icoon (optioneel)."
        />
      </div>

      <div>
        <label className="block text-sm text-ink mb-1" htmlFor="image">
          Hoofdafbeelding (optioneel, max 2MB — PNG/JPG/WEBP/GIF)
        </label>
        <input
          ref={fileInputRef}
          id="image"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={handleImageChange}
          className="text-sm"
        />
        {imagePreviewUrl && (
          <div className="mt-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagePreviewUrl} alt="" className="max-h-40 max-w-full rounded-md border border-line" />
            <button
              type="button"
              onClick={handleRemoveImage}
              className="mt-1 block text-xs text-red-600 hover:underline"
            >
              Afbeelding verwijderen
            </button>
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm text-ink mb-1" htmlFor="comments">
          Opmerkingen (optioneel)
        </label>
        <textarea
          id="comments"
          rows={3}
          value={draft.comments}
          onChange={(e) => set("comments", e.target.value)}
          className={inputClass}
        />
      </div>

      <FormActions
        price={price}
        loading={loading}
        editing={editing}
        discardOrderItemId={discardOrderItemId}
        backHref={backHref}
      />
    </form>
  );
}
