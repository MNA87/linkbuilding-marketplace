"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminCreateTestOrderAction } from "./actions";
import RichTextEditor from "@/components/RichTextEditor";

type WebsiteProduct = {
  id: string;
  domain: string;
  productName: string;
  wpCategories: { id: string; name: string }[];
};

export default function AdminTestOrderForm({ websiteProducts }: { websiteProducts: WebsiteProduct[] }) {
  const router = useRouter();
  const [websiteProductId, setWebsiteProductId] = useState("");
  const [wpCategoryId, setWpCategoryId] = useState("");
  const [articleTitle, setArticleTitle] = useState("Testartikel");
  const [articleBody, setArticleBody] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selected = websiteProducts.find((wp) => wp.id === websiteProductId);
  const inputClass =
    "w-full border border-line rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand";

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0] ?? null;
    setImageFile(selectedFile);
    setImagePreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return selectedFile ? URL.createObjectURL(selectedFile) : null;
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

    setLoading(true);
    try {
      const result = await adminCreateTestOrderAction({
        websiteProductId,
        wpCategoryId,
        articleTitle,
        articleBody,
        articleImageKey,
      });
      if (!result.success) {
        setError(result.error ?? "Er ging iets mis.");
        return;
      }
      router.push("/admin/orders");
    } catch {
      setError("Er ging iets mis. Probeer het opnieuw.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-surface border border-line rounded-lg p-6">
      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}

      <div>
        <label className="block text-sm text-ink mb-1" htmlFor="websiteProductId">
          Site &amp; product
        </label>
        <select
          id="websiteProductId"
          required
          value={websiteProductId}
          onChange={(e) => {
            setWebsiteProductId(e.target.value);
            setWpCategoryId("");
          }}
          className={inputClass}
        >
          <option value="" disabled>
            Kies...
          </option>
          {websiteProducts.map((wp) => (
            <option key={wp.id} value={wp.id}>
              {wp.domain} — {wp.productName}
            </option>
          ))}
        </select>
      </div>

      {selected && selected.wpCategories.length > 0 && (
        <div>
          <label className="block text-sm text-ink mb-1" htmlFor="wpCategoryId">
            Categorie op de site
          </label>
          <select
            id="wpCategoryId"
            value={wpCategoryId}
            onChange={(e) => setWpCategoryId(e.target.value)}
            className={inputClass}
          >
            <option value="">(geen)</option>
            {selected.wpCategories.map((c) => (
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
          value={articleTitle}
          onChange={(e) => setArticleTitle(e.target.value)}
          className={inputClass}
        />
      </div>

      <div>
        <label className="block text-sm text-ink mb-1">Tekst</label>
        <RichTextEditor
          value={articleBody}
          onChange={setArticleBody}
          placeholder="Schrijf een testartikel... selecteer tekst en klik op het link-icoon om een link toe te voegen."
        />
      </div>

      <div>
        <label className="block text-sm text-ink mb-1" htmlFor="image">
          Hoofdafbeelding (optioneel)
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

      <button
        type="submit"
        disabled={loading || !websiteProductId}
        className="bg-brand text-white rounded-md px-5 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
      >
        {loading ? "Bezig..." : "Testorder aanmaken (PAID)"}
      </button>
    </form>
  );
}
