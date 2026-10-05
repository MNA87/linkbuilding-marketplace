"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminSaveListingDetailsAction } from "../actions";

const input =
  "mt-1 h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-[var(--btn-pay-bg)]";

// "Gegevens voor het overzicht": niches besides the main category, max
// links, sponsored label and an example article.
export default function ListingDetailsForm({
  websiteId,
  mainCategory,
  categories,
  initial,
}: {
  websiteId: string;
  mainCategory: { id: string; name: string };
  categories: { id: string; name: string }[];
  initial: { nicheIds: string[]; maxLinks: string; sponsored: boolean; exampleUrl: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const toggle = (id: string) =>
    setForm((f) => ({
      ...f,
      nicheIds: f.nicheIds.includes(id) ? f.nicheIds.filter((n) => n !== id) : [...f.nicheIds, id],
    }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        startTransition(async () => {
          const r = await adminSaveListingDetailsAction({ websiteId, ...form });
          setMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: "Opgeslagen." });
          if (!r.error) router.refresh();
        });
      }}
    >
      <div className="mt-3 text-xs text-inkSoft">Niches</div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <span className="rounded-full border border-[var(--btn-pay-bg)] bg-[var(--pay-soft)] px-3 py-1 text-xs font-semibold text-[var(--btn-pay-bg)]">
          {mainCategory.name} · hoofd
        </span>
        {categories
          .filter((c) => c.id !== mainCategory.id)
          .map((c) => {
            const on = form.nicheIds.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(c.id)}
                aria-pressed={on}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  on
                    ? "border-[var(--btn-pay-bg)] bg-[var(--pay-soft)] font-semibold text-[var(--btn-pay-bg)]"
                    : "border-line text-inkSoft hover:text-ink"
                }`}
              >
                {c.name}
              </button>
            );
          })}
      </div>
      <p className="mt-1.5 text-xs text-inkSoft">
        De hoofdniche is de categorie onder &ldquo;Website-gegevens bewerken&rdquo;. Nieuwe niches voeg je toe onder
        Instellingen → Stamdata.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="text-xs text-inkSoft">
          Max links per artikel
          <input
            value={form.maxLinks}
            onChange={(e) => setForm((f) => ({ ...f, maxLinks: e.target.value }))}
            inputMode="numeric"
            placeholder="–"
            className={input}
          />
        </label>
        <label className="text-xs text-inkSoft">
          Gesponsord-label
          <select
            value={form.sponsored ? "ja" : "nee"}
            onChange={(e) => setForm((f) => ({ ...f, sponsored: e.target.value === "ja" }))}
            className={input}
          >
            <option value="nee">Nee</option>
            <option value="ja">Ja</option>
          </select>
        </label>
        <label className="text-xs text-inkSoft sm:col-span-3">
          Voorbeeldartikel
          <input
            value={form.exampleUrl}
            onChange={(e) => setForm((f) => ({ ...f, exampleUrl: e.target.value }))}
            placeholder="Leeg = Op aanvraag"
            className={input}
          />
        </label>
      </div>
      <div className="mt-3 flex items-center justify-end gap-3">
        {msg && <span className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</span>}
        <button
          type="submit"
          disabled={pending}
          className="btn-pay rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
        >
          {pending ? "Bezig..." : "Opslaan"}
        </button>
      </div>
    </form>
  );
}
