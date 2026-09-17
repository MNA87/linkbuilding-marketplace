"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminAddWpCategoryAction, adminRemoveWpCategoryAction } from "../actions";

type WpCategory = { id: string; wpTermId: number; name: string };

export default function WpCategoriesSection({
  websiteId,
  categories,
}: {
  websiteId: string;
  categories: WpCategory[];
}) {
  const router = useRouter();
  const [wpTermId, setWpTermId] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const inputClass =
    "w-full border border-line rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand";

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await adminAddWpCategoryAction({ websiteId, wpTermId, name });
      if (!result.success) {
        setError(result.error ?? "Toevoegen mislukt.");
        return;
      }
      setWpTermId("");
      setName("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(id: string) {
    setLoading(true);
    try {
      await adminRemoveWpCategoryAction(id);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-surface border border-line rounded-lg p-4 mb-6">
      <h2 className="font-medium text-ink mb-1">WordPress-categorieën</h2>
      <p className="text-sm text-inkSoft mb-3">
        De categorieën die een klant kan kiezen bij het bestellen — het artikel wordt in de gekozen categorie
        gepubliceerd. Zoek het category-ID op in WordPress bij Berichten &rarr; Categorieën: klik een categorie
        aan en kijk in de link in de adresbalk naar <code className="bg-brandSoft/50 px-1 rounded">tag_ID=</code>.
      </p>

      {categories.length > 0 && (
        <div className="space-y-1 mb-3">
          {categories.map((c) => (
            <div key={c.id} className="flex items-center justify-between border border-line rounded-md px-3 py-1.5">
              <span className="text-sm text-ink">
                {c.name} <span className="text-inkSoft">(ID: {c.wpTermId})</span>
              </span>
              <button
                onClick={() => handleRemove(c.id)}
                disabled={loading}
                className="text-xs text-red-600 hover:underline disabled:opacity-50"
              >
                Verwijderen
              </button>
            </div>
          ))}
        </div>
      )}
      {categories.length === 0 && (
        <p className="text-sm text-inkSoft mb-3">
          Nog geen categorieën ingesteld — de klant krijgt dan geen keuze en WordPress gebruikt zijn standaardcategorie.
        </p>
      )}

      <form onSubmit={handleAdd} className="flex items-end gap-2">
        {error && <div className="text-sm text-red-600 basis-full">{error}</div>}
        <div className="flex-1">
          <label className="block text-xs text-inkSoft mb-1">Naam</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} required />
        </div>
        <div className="w-28">
          <label className="block text-xs text-inkSoft mb-1">Category-ID</label>
          <input
            type="number"
            min={1}
            value={wpTermId}
            onChange={(e) => setWpTermId(e.target.value)}
            className={inputClass}
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="bg-brand text-white rounded-md px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
        >
          Toevoegen
        </button>
      </form>
    </div>
  );
}
