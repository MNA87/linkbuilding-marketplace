"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setMailLinksAction } from "./actions";

type Link = { anchor: string; url: string; from?: number };

const input =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-[var(--btn-pay-bg)]";

// The links read from the mail; "Aanpassen" to correct an anchor or URL,
// remove one or add one before the order is made.
export function LinksEditor({
  mailId,
  links,
  editable,
  maxInOrder,
  inArticle = false,
}: {
  mailId: string;
  links: Link[];
  editable: boolean;
  maxInOrder: number | null;
  inArticle?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<Link[]>(links);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (i: number, key: keyof Link, value: string) =>
    setRows((r) => r.map((row, j) => (j === i ? { ...row, [key]: value } : row)));

  if (!editing) {
    return (
      <div className="mt-3 text-xs text-inkSoft">
        <div className="flex items-center justify-between">
          Links
          {editable && (
            <button
              type="button"
              onClick={() => {
                setRows(links.length ? links.map((l, i) => ({ ...l, from: i })) : [{ anchor: "", url: "" }]);
                setError(null);
                setEditing(true);
              }}
              className="text-xs font-medium text-brand hover:underline"
            >
              Aanpassen
            </button>
          )}
        </div>
        {links.length > 0 ? (
          <div className="mt-1 divide-y divide-line rounded-lg border border-line">
            {links.map((l, i) => (
              <div key={i} className="break-words px-3 py-2 text-sm">
                <span className="text-ink">&ldquo;{l.anchor || "zonder ankertekst"}&rdquo;</span>{" "}
                <span className="text-inkSoft">→ {l.url}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-inkSoft">
            Geen links gevonden
          </div>
        )}
        {maxInOrder !== null && links.length > maxInOrder && (
          <div className="mt-1">De eerste {maxInOrder} links gaan mee in de order.</div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-line bg-gray-50 p-3 text-xs text-inkSoft">
      <div className="hidden grid-cols-[1fr_1.4fr_auto] gap-2 sm:grid">
        <span>Ankertekst</span>
        <span>URL</span>
        <span className="w-7" />
      </div>
      <div className="mt-1 space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
            <input
              value={row.anchor}
              onChange={(e) => set(i, "anchor", e.target.value)}
              placeholder="Ankertekst"
              aria-label="Ankertekst"
              className={input}
            />
            <input
              value={row.url}
              onChange={(e) => set(i, "url", e.target.value)}
              placeholder="https://"
              aria-label="URL"
              className={`${input} col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto`}
            />
            <button
              type="button"
              onClick={() => setRows((r) => r.filter((_, j) => j !== i))}
              aria-label="Link verwijderen"
              className="h-9 w-7 rounded-lg text-lg leading-none text-inkSoft hover:bg-gray-100 hover:text-red-700 sm:row-start-auto"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      {rows.length < 10 && (
        <button
          type="button"
          onClick={() => setRows((r) => [...r, { anchor: "", url: "" }])}
          className="mt-2 text-xs font-medium text-brand hover:underline"
        >
          + Link toevoegen
        </button>
      )}
      {inArticle && (
        <div className="mt-2">
          Wat je aanpast, verandert ook in de tekst van het artikel. Een nieuwe link staat nog niet in de tekst; die zet
          je erin bij de order.
        </div>
      )}
      {error && <div className="mt-2 text-sm text-red-700">{error}</div>}
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink hover:bg-gray-50"
        >
          Annuleren
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const r = await setMailLinksAction(
                mailId,
                rows.filter((l) => l.anchor.trim() || l.url.trim())
              );
              if (r.error) setError(r.error);
              else {
                setEditing(false);
                router.refresh();
              }
            })
          }
          className="btn-pay rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-60"
        >
          {pending ? "Bezig..." : "Opslaan"}
        </button>
      </div>
    </div>
  );
}
