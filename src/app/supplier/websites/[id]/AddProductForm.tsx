"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addWebsiteProductSchema } from "@/lib/validations/website";
import { addWebsiteProductAction } from "../actions";

export default function AddProductForm({
  websiteId,
  existingProductTypes,
}: {
  websiteId: string;
  existingProductTypes: string[];
}) {
  const router = useRouter();
  const options = (["BLOG_POST", "HOMEPAGE_LINK"] as const).filter((t) => !existingProductTypes.includes(t));
  const [productType, setProductType] = useState<"BLOG_POST" | "HOMEPAGE_LINK">(options[0]);
  const [supplierPrice, setSupplierPrice] = useState("");
  const [minWords, setMinWords] = useState("500");
  const [maxWords, setMaxWords] = useState("900");
  const [maxLinks, setMaxLinks] = useState("1");
  const [dofollow, setDofollow] = useState(true);
  const [permanent, setPermanent] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const input = { websiteId, productType, supplierPrice, minWords, maxWords, maxLinks, dofollow, permanent };
    const parsed = addWebsiteProductSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Ongeldige invoer");
      return;
    }

    setLoading(true);
    try {
      const result = await addWebsiteProductAction(input);
      if (!result.success) {
        setError(result.error ?? "Er ging iets mis.");
        return;
      }
      router.refresh();
    } catch {
      setError("Er ging iets mis. Probeer het opnieuw.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full border border-line rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand";

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-ink mb-1">Type</label>
          <select
            value={productType}
            onChange={(e) => setProductType(e.target.value as "BLOG_POST" | "HOMEPAGE_LINK")}
            className={inputClass}
          >
            {options.map((t) => (
              <option key={t} value={t}>
                {t === "BLOG_POST" ? "Blogartikel" : "Homepage-link"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-ink mb-1">Prijs (&euro;)</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={supplierPrice}
            onChange={(e) => setSupplierPrice(e.target.value)}
            className={inputClass}
            required
          />
        </div>
      </div>
      {productType === "BLOG_POST" && (
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm text-ink mb-1">Min. woorden</label>
            <input type="number" value={minWords} onChange={(e) => setMinWords(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm text-ink mb-1">Max. woorden</label>
            <input type="number" value={maxWords} onChange={(e) => setMaxWords(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm text-ink mb-1">Max. links</label>
            <input type="number" value={maxLinks} onChange={(e) => setMaxLinks(e.target.value)} className={inputClass} />
          </div>
        </div>
      )}
      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={dofollow} onChange={(e) => setDofollow(e.target.checked)} />
          Dofollow
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={permanent} onChange={(e) => setPermanent(e.target.checked)} />
          Permanent
        </label>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="bg-brand text-white rounded-md px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
      >
        {loading ? "Bezig..." : "Toevoegen"}
      </button>
    </form>
  );
}
