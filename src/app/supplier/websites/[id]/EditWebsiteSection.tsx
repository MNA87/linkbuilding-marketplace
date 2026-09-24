"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { editWebsiteSchema } from "@/lib/validations/websiteEdit";
import { editWebsiteAction } from "../actions";

type Option = { id: string; name: string };
type WebsiteData = {
  id: string;
  domain: string;
  description: string;
  categoryId: string;
  countryId: string;
  languageId: string;
  domainRating: number;
  domainAuthority: number;
  organicTraffic: number;
  referringDomains: number;
};

export default function EditWebsiteSection({
  website,
  categories,
  countries,
  languages,
}: {
  website: WebsiteData;
  categories: Option[];
  countries: Option[];
  languages: Option[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    domain: website.domain,
    description: website.description,
    categoryId: website.categoryId,
    countryId: website.countryId,
    languageId: website.languageId,
    domainRating: String(website.domainRating),
    domainAuthority: String(website.domainAuthority),
    organicTraffic: String(website.organicTraffic),
    referringDomains: String(website.referringDomains),
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const input = { websiteId: website.id, ...form };
    const parsed = editWebsiteSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Ongeldige invoer");
      return;
    }

    setLoading(true);
    try {
      const result = await editWebsiteAction(input);
      if (!result.success) {
        setError(result.error ?? "Er ging iets mis.");
        return;
      }
      router.refresh();
      setOpen(false);
    } catch {
      setError("Er ging iets mis. Probeer het opnieuw.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full border border-line rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand";

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-sm text-brand hover:underline">
        Website-gegevens bewerken
      </button>
    );
  }

  return (
    <div className="bg-surface border border-line rounded-lg p-4">
      <h2 className="font-medium text-ink mb-3">Website-gegevens bewerken</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>
        )}
        <div>
          <label className="block text-sm text-ink mb-1">Domein</label>
          <input value={form.domain} onChange={(e) => set("domain", e.target.value)} className={inputClass} required />
          <p className="text-xs text-inkSoft mt-1">
            Een domeinwijziging zet de website terug naar &quot;in beoordeling&quot;.
          </p>
        </div>
        <div>
          <label className="block text-sm text-ink mb-1">Omschrijving</label>
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
              value={form.domainRating}
              onChange={(e) => set("domainRating", e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm text-ink mb-1">DA</label>
            <input
              type="number"
              value={form.domainAuthority}
              onChange={(e) => set("domainAuthority", e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm text-ink mb-1">Verkeer</label>
            <input
              type="number"
              value={form.organicTraffic}
              onChange={(e) => set("organicTraffic", e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm text-ink mb-1">Ref. domains</label>
            <input
              type="number"
              value={form.referringDomains}
              onChange={(e) => set("referringDomains", e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="btn-primary rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60 transition"
          >
            {loading ? "Bezig..." : "Opslaan"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="border border-line text-inkSoft rounded-md px-4 py-2 text-sm hover:bg-brandSoft transition-colors"
          >
            Annuleren
          </button>
        </div>
      </form>
    </div>
  );
}
