"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createOrderSchema } from "@/lib/validations/order";
import { addToCartAction } from "./actions";
import RichTextEditor from "@/components/RichTextEditor";

export default function OrderForm({ websiteProductId, price }: { websiteProductId: string; price: string }) {
  const router = useRouter();
  const [articleTitle, setArticleTitle] = useState("");
  const [articleBody, setArticleBody] = useState("");
  const [comments, setComments] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

    const input = { websiteProductId, articleTitle, articleBody, comments, articleImageKey };

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
          placeholder="Schrijf je artikel... selecteer tekst en klik op het link-icoon om 'm naar je eigen site te linken."
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
          value={comments}
          onChange={(e) => setComments(e.target.value)}
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
