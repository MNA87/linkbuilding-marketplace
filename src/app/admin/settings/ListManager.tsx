"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { WORLD_COUNTRIES, WORLD_LANGUAGES, worldSuggestions } from "@/lib/worldLists";
import {
  addCategoryAction,
  addTopicAction,
  addWorldItemAction,
  deleteListItemAction,
  renameListItemAction,
  type ListKind,
} from "./actions";

export type ListItem = { id: string; name: string; code?: string; count: number };

const NOUN: Record<ListKind, string> = { category: "niche", topic: "onderwerp", country: "land", language: "taal" };
const SAGE = "bg-[#eff3f0] text-[#5b7266]";

// One list of Instellingen → Lijsten as a table: search (and add what isn't
// there yet), how many websites use each, rename, and remove what's unused.
// Countries and languages are picked from the world list, code included.
export default function ListManager({ kind, items, note }: { kind: ListKind; items: ListItem[]; note?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [show, setShow] = useState<"alle" | "gebruikt" | "leeg">("alle");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const world = kind === "country" ? WORLD_COUNTRIES : kind === "language" ? WORLD_LANGUAGES : null;
  const q = query.trim().toLowerCase();
  const used = items.filter((i) => i.count > 0).length;
  const shown = items.filter(
    (i) =>
      (!q || i.name.toLowerCase().includes(q)) &&
      (show === "alle" || (show === "gebruikt" ? i.count > 0 : i.count === 0))
  );
  const exact = items.some((i) => i.name.toLowerCase() === q);
  const suggestions = world
    ? worldSuggestions(
        world,
        query,
        items.flatMap((i) => (i.code ? [i.code] : []))
      ).filter((s) => !items.some((i) => i.name.toLowerCase() === s.name.toLowerCase()))
    : [];

  const canAdd = Boolean(q) && (world ? suggestions.length > 0 : !exact);

  async function run(action: () => Promise<{ error: string | null }>) {
    setBusy(true);
    setError(null);
    const r = await action();
    setBusy(false);
    if (r.error) {
      setError(r.error);
      return false;
    }
    router.refresh();
    return true;
  }
  const addName = async () => {
    if (await run(() => (kind === "topic" ? addTopicAction(query) : addCategoryAction(query)))) setQuery("");
  };
  const addWorld = async (code: string) => {
    if (await run(() => addWorldItemAction(kind as "country" | "language", code))) setQuery("");
  };
  const rename = async () => {
    if (!editing) return;
    if (await run(() => renameListItemAction(kind, editing.id, editing.name))) setEditing(null);
  };
  const remove = async (item: ListItem) => {
    // A topic in use takes its prices on every site with it.
    if (
      kind === "topic" &&
      item.count > 0 &&
      !confirm(`${item.name} verwijderen? De prijzen hiervoor bij alle websites gaan ook weg.`)
    )
      return;
    if (kind !== "topic" && !confirm(`${item.name} verwijderen?`)) return;
    await run(() => deleteListItemAction(kind, item.id));
  };

  const chip = (key: typeof show, label: string) => (
    <button
      type="button"
      onClick={() => setShow(key)}
      className={`px-3 py-1.5 text-sm ${show === key ? "bg-gray-100 font-medium text-ink" : "text-inkSoft hover:text-ink"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="rounded-xl border border-line bg-surface">
      {note && <p className="px-4 pt-4 text-sm text-inkSoft">{note}</p>}
      <div className="flex flex-wrap items-center gap-3 border-b border-line/70 p-4">
        <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-surface px-3 focus-within:ring-2 focus-within:ring-[var(--btn-pay-bg)]">
          <Search size={15} className="shrink-0 text-inkSoft" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              if (world) {
                if (suggestions[0]) void addWorld(suggestions[0].code);
              } else if (q && !exact) void addName();
            }}
            placeholder={
              world ? `Zoek of voeg een ${NOUN[kind]} toe, bijv. "Dui"` : `Zoek of voeg een ${NOUN[kind]} toe`
            }
            aria-label={`Zoek of voeg een ${NOUN[kind]} toe`}
            className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-inkSoft/80 focus:outline-none"
          />
        </label>
        <div className="flex overflow-hidden rounded-lg border border-line">
          {chip("alle", `Alle ${items.length}`)}
          {chip("gebruikt", `In gebruik ${used}`)}
          {chip("leeg", `Leeg ${items.length - used}`)}
        </div>
      </div>

      {canAdd && (
        <div className="flex flex-wrap items-center gap-2 border-b border-line/70 bg-gray-50/60 px-4 py-3 text-sm">
          <span className="text-inkSoft">Toevoegen:</span>
          {world ? (
            suggestions.map((s) => (
              <button
                key={s.code}
                type="button"
                disabled={busy}
                onClick={() => void addWorld(s.code)}
                className="btn-pay inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold disabled:opacity-60"
              >
                <Plus size={14} /> {s.name} <span className="font-normal opacity-80">{s.code}</span>
              </button>
            ))
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => void addName()}
              className="btn-pay inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold disabled:opacity-60"
            >
              <Plus size={14} /> &lsquo;{query.trim()}&rsquo;
            </button>
          )}
        </div>
      )}
      {error && <p className="border-b border-line/70 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs font-semibold text-ink">
          <tr>
            <th className="px-4 py-2.5">Naam</th>
            <th className="px-4 py-2.5">Websites</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {shown.map((item) => (
            <tr key={item.id} className="border-t border-line/70">
              <td className="px-4 py-2.5">
                {editing?.id === item.id ? (
                  <input
                    autoFocus
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void rename();
                      if (e.key === "Escape") setEditing(null);
                    }}
                    aria-label="Nieuwe naam"
                    className="h-8 w-56 rounded-lg border border-line px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--btn-pay-bg)]"
                  />
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <span
                      className={
                        kind === "category"
                          ? `rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase ${SAGE}`
                          : "text-ink"
                      }
                    >
                      {item.name}
                    </span>
                    {item.code && <span className="text-xs text-inkSoft">{item.code}</span>}
                  </span>
                )}
              </td>
              <td className={`px-4 py-2.5 tabular-nums ${item.count ? "text-ink" : "text-inkSoft"}`}>
                {item.count === 0 ? "—" : item.count === 1 ? "1 website" : `${item.count} websites`}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 text-right">
                {editing?.id === item.id ? (
                  <span className="inline-flex items-center gap-3">
                    <button type="button" onClick={() => setEditing(null)} className="text-inkSoft hover:text-ink">
                      Annuleren
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void rename()}
                      className="btn-pay rounded-lg px-3 py-1 font-semibold disabled:opacity-60"
                    >
                      Opslaan
                    </button>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-3 text-inkSoft">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing({ id: item.id, name: item.name });
                        setError(null);
                      }}
                      className="hover:text-ink"
                    >
                      Hernoemen
                    </button>
                    {(item.count === 0 || kind === "topic") && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void remove(item)}
                        className="text-red-600 hover:text-red-700"
                      >
                        Verwijderen
                      </button>
                    )}
                  </span>
                )}
              </td>
            </tr>
          ))}
          {shown.length === 0 && (
            <tr>
              <td colSpan={3} className="px-4 py-8 text-center text-inkSoft">
                {q
                  ? canAdd
                    ? "Nog niet in de lijst: voeg hem hierboven toe."
                    : "Niets gevonden."
                  : "Nog niets in deze lijst."}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
