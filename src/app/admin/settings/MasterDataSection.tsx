"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  addCategoryAction,
  deleteCategoryAction,
  addCountryAction,
  deleteCountryAction,
  addLanguageAction,
  deleteLanguageAction,
} from "./actions";

type Item = { id: string; label: string; inUse: boolean };
type Kind = "category" | "country" | "language";

const ADD_ACTIONS: Record<Kind, (name: string, code: string) => Promise<{ error: string | null; success: boolean }>> = {
  category: (name) => addCategoryAction(name),
  country: (name, code) => addCountryAction(name, code),
  language: (name, code) => addLanguageAction(name, code),
};

const DELETE_ACTIONS: Record<Kind, (id: string) => Promise<{ error: string | null; success: boolean }>> = {
  category: deleteCategoryAction,
  country: deleteCountryAction,
  language: deleteLanguageAction,
};

export default function MasterDataSection({
  title,
  kind,
  items,
  withCode = false,
}: {
  title: string;
  kind: Kind;
  items: Item[];
  withCode?: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await ADD_ACTIONS[kind](name, code);
      if (!result.success) {
        setError(result.error ?? "Er ging iets mis.");
        return;
      }
      setName("");
      setCode("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    const result = await DELETE_ACTIONS[kind](id);
    if (!result.success) setError(result.error ?? "Er ging iets mis.");
    else router.refresh();
  }

  return (
    <div className="bg-surface border border-line rounded-lg p-4">
      <h2 className="font-medium text-ink mb-3">{title}</h2>
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-3">{error}</div>
      )}
      <div className="flex flex-wrap gap-2 mb-3">
        {items.map((item) => (
          <span
            key={item.id}
            className="inline-flex items-center gap-2 border border-line rounded-full px-3 py-1 text-sm text-ink"
          >
            {item.label}
            <button
              onClick={() => handleDelete(item.id)}
              title={item.inUse ? "Nog in gebruik" : "Verwijderen"}
              className="text-inkSoft hover:text-red-600"
            >
              &times;
            </button>
          </span>
        ))}
        {items.length === 0 && <span className="text-sm text-inkSoft">Nog niets toegevoegd.</span>}
      </div>
      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Naam"
          className="border border-line rounded-md px-3 py-1.5 text-sm flex-1 min-w-0"
          required
        />
        {withCode && (
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Code"
            className="border border-line rounded-md px-3 py-1.5 text-sm w-24"
            required
          />
        )}
        <button
          type="submit"
          disabled={loading}
          className="btn-primary rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-60"
        >
          {loading ? "..." : "Toevoegen"}
        </button>
      </form>
    </div>
  );
}
