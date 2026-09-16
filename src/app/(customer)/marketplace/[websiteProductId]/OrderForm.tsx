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
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    let uploadedFileUrl = "";
    if (file) {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Uploaden mislukt.");
        return;
      }
      uploadedFileUrl = body.key;
    }

    const input = { websiteProductId, articleTitle, articleBody, comments, uploadedFileUrl };

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
        <label className="block text-sm text-ink mb-1" htmlFor="file">
          Bijlage (optioneel, max 10MB — PDF/Word/afbeelding/tekst)
        </label>
        <input
          id="file"
          type="file"
          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.txt"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm"
        />
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
