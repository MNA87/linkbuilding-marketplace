"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createOrderSchema } from "@/lib/validations/order";
import { addToCartAction } from "./actions";
import RichTextEditor from "@/components/RichTextEditor";

type Draft = {
  targetUrl: string;
  wpCategoryId: string;
  articleTitle: string;
  articleBody: string;
  comments: string;
};

const EMPTY_DRAFT: Draft = {
  targetUrl: "",
  wpCategoryId: "",
  articleTitle: "",
  articleBody: "",
  comments: "",
};

function draftKey(websiteProductId: string): string {
  return `nugevonden-order-draft-${websiteProductId}`;
}

export default function OrderForm({
  websiteProductId,
  price,
  wpCategories,
}: {
  websiteProductId: string;
  price: string;
  wpCategories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Restore a draft the customer left behind (e.g. an accidental refresh) —
  // read after mount, not as the initial state, so server and first client
  // render still match and React doesn't complain about a hydration mismatch.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(draftKey(websiteProductId));
      if (saved) setDraft({ ...EMPTY_DRAFT, ...JSON.parse(saved) });
    } catch {
      // Corrupt or inaccessible storage — just start from a blank form.
    }
  }, [websiteProductId]);

  useEffect(() => {
    try {
      window.localStorage.setItem(draftKey(websiteProductId), JSON.stringify(draft));
    } catch {
      // Storage full/blocked — losing autosave isn't worth surfacing an error for.
    }
  }, [draft, websiteProductId]);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function clearDraft() {
    try {
      window.localStorage.removeItem(draftKey(websiteProductId));
    } catch {
      // Nothing to clean up if storage isn't available.
    }
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setImageFile(selected);
    setImagePreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return selected ? URL.createObjectURL(selected) : null;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    let articleImageKey = "";
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
      const result = await addToCartAction(input);
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

      <div>
        <label className="block text-sm text-ink mb-1" htmlFor="targetUrl">
          Doel-URL (jouw pagina waar naartoe gelinkt wordt)
        </label>
        <input
          id="targetUrl"
          type="url"
          required
          placeholder="https://jouwsite.nl/pagina"
          value={draft.targetUrl}
          onChange={(e) => set("targetUrl", e.target.value)}
          className={inputClass}
        />
      </div>

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
          placeholder="Schrijf je artikel... selecteer een stukje tekst en klik op het link-icoon om 'm naar je doel-URL hierboven te linken."
        />
      </div>

      <div>
        <label className="block text-sm text-ink mb-1" htmlFor="image">
          Hoofdafbeelding (optioneel, max 2MB — PNG/JPG/WEBP/GIF)
        </label>
        <input
          id="image"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={handleImageChange}
          className="text-sm"
        />
        {imagePreviewUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imagePreviewUrl} alt="" className="mt-2 max-h-40 rounded-md border border-line" />
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
          {loading ? "Bezig..." : "Toevoegen aan winkelmandje"}
        </button>
      </div>
    </form>
  );
}
