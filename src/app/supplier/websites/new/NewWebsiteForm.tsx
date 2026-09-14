"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createWebsiteSchema } from "@/lib/validations/website";
import { createWebsiteAction } from "../actions";

type Option = { id: string; name: string };

export default function NewWebsiteForm({
  categories,
  countries,
  languages,
}: {
  categories: Option[];
  countries: Option[];
  languages: Option[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    domain: "",
    description: "",
    categoryId: categories[0]?.id ?? "",
    countryId: countries[0]?.id ?? "",
    languageId: languages[0]?.id ?? "",
    domainRating: "",
    domainAuthority: "",
    organicTraffic: "",
    referringDomains: "",
    productType: "BLOG_POST" as "BLOG_POST" | "HOMEPAGE_LINK",
    supplierPrice: "",
    minWords: "500",
    maxWords: "900",
    maxLinks: "1",
    dofollow: true,
    permanent: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = createWebsiteSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Ongeldige invoer");
      return;
    }

    setLoading(true);
    try {
      const result = await createWebsiteAction(form);
      if (!result.success) {
        setError(result.error ?? "Er ging iets mis.");
        return;
      }
      router.push(`/supplier/websites/${result.id}`);
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
        <label className="block text-sm text-ink mb-1">Domein</label>
        <input
          placeholder="voorbeeld.nl"
          value={form.domain}
          onChange={(e) => set("domain", e.target.value)}
          className={inputClass}
          required
        />
      </div>

      <div>
        <label className="block text-sm text-ink mb-1">Omschrijving (optioneel)</label>
        <textarea
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          rows={3}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-sm text-ink mb-1">Categorie</label>
          <select value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)} className={inputClass}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-ink mb-1">Land</label>
          <select value={form.countryId} onChange={(e) => set("countryId", e.target.value)} className={inputClass}>
            {countries.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-ink mb-1">Taal</label>
          <select value={form.languageId} onChange={(e) => set("languageId", e.target.value)} className={inputClass}>
            {languages.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-sm text-ink mb-1">DR</label>
          <input
            type="number"
            min={0}
            max={100}
            value={form.domainRating}
            onChange={(e) => set("domainRating", e.target.value)}
            className={inputClass}
            required
          />
        </div>
        <div>
          <label className="block text-sm text-ink mb-1">DA</label>
          <input
            type="number"
            min={0}
            max={100}
            value={form.domainAuthority}
            onChange={(e) => set("domainAuthority", e.target.value)}
            className={inputClass}
            required
          />
        </div>
        <div>
          <label className="block text-sm text-ink mb-1">Organisch verkeer</label>
          <input
            type="number"
            min={0}
            value={form.organicTraffic}
            onChange={(e) => set("organicTraffic", e.target.value)}
            className={inputClass}
            required
          />
        </div>
        <div>
          <label className="block text-sm text-ink mb-1">Referring domains</label>
          <input
            type="number"
            min={0}
            value={form.referringDomains}
            onChange={(e) => set("referringDomains", e.target.value)}
            className={inputClass}
            required
          />
        </div>
      </div>

      <div className="border-t border-line pt-4">
        <h3 className="text-sm font-medium text-ink mb-3">Eerste product & prijs</h3>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-sm text-ink mb-1">Type</label>
            <select
              value={form.productType}
              onChange={(e) => set("productType", e.target.value as "BLOG_POST" | "HOMEPAGE_LINK")}
              className={inputClass}
            >
              <option value="BLOG_POST">Blogartikel</option>
              <option value="HOMEPAGE_LINK">Homepage-link</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-ink mb-1">Jouw prijs (&euro;)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.supplierPrice}
              onChange={(e) => set("supplierPrice", e.target.value)}
              className={inputClass}
              required
            />
          </div>
        </div>
        {form.productType === "BLOG_POST" && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-sm text-ink mb-1">Min. woorden</label>
              <input
                type="number"
                min={0}
                value={form.minWords}
                onChange={(e) => set("minWords", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm text-ink mb-1">Max. woorden</label>
              <input
                type="number"
                min={0}
                value={form.maxWords}
                onChange={(e) => set("maxWords", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm text-ink mb-1">Max. links</label>
              <input
                type="number"
                min={1}
                value={form.maxLinks}
                onChange={(e) => set("maxLinks", e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        )}
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={form.dofollow} onChange={(e) => set("dofollow", e.target.checked)} />
            Dofollow
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={form.permanent} onChange={(e) => set("permanent", e.target.checked)} />
            Permanent
          </label>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="bg-brand text-white rounded-md px-5 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
      >
        {loading ? "Bezig..." : "Indienen ter beoordeling"}
      </button>
    </form>
  );
}
