"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createOrderSchema } from "@/lib/validations/order";
import { addToCartAction, updateCartItemContentAction } from "./actions";
import RichTextEditor from "@/components/RichTextEditor";

type Draft = {
  wpCategoryId: string;
  articleTitle: string;
  articleBody: string;
  comments: string;
  nofollow: boolean;
};

const EMPTY_DRAFT: Draft = {
  wpCategoryId: "",
  articleTitle: "",
  articleBody: "",
  comments: "",
  nofollow: false,
};

function draftKey(key: string): string {
  return `nugevonden-order-draft-${key}`;
}

export default function OrderForm({
  websiteProductId,
  price,
  wpCategories,
  orderItemId,
  initialDraft,
  initialImageKey,
}: {
  websiteProductId: string;
  price: string;
  wpCategories: { id: string; name: string }[];
  orderItemId?: string;
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

    const input = { websiteProductId, ...draft, articleImageKey };

    const parsed = createOrderSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Ongeldige invoer");
      return;
    }

    setLoading(true);
    try {
      const result = editing
        ? await updateCartItemContentAction({ orderItemId, ...draft, articleImageKey })
        : await addToCartAction(input);
      if (!result.success) {
        setError(result.error ?? "Er ging iets mis.");
        return;
      }
      clearDraft();
      router.push("/dashboard/cart");
    } catch {
      setError("Er ging iets mis. Probeer het opnieuw.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full border border-line rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand";

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
          value={draft.articleTitle}
          onChange={(e) => set("articleTitle", e.target.value)}
          className={inputClass}
        />
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
        <label className="block text-sm text-ink mb-1">Type link (als je er een plaatst)</label>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="nofollow"
              checked={!draft.nofollow}
              onChange={() => set("nofollow", false)}
            />
            Dofollow
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="nofollow"
              checked={draft.nofollow}
              onChange={() => set("nofollow", true)}
            />
            Nofollow
          </label>
        </div>
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

      <div className="flex items-center justify-between pt-2 border-t border-line">
        <div className="text-sm text-inkSoft">
          Totaal: <span className="text-ink font-medium">&euro;{price}</span>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="bg-brand text-white rounded-md px-5 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
        >
          {loading ? "Bezig..." : editing ? "Opslaan" : "Toevoegen aan winkelmandje"}
        </button>
      </div>
    </form>
  );
}
