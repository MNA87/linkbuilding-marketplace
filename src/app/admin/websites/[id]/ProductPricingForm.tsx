"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminSaveProductPricingAction } from "../actions";

const field =
  "h-9 w-28 rounded-lg border border-line bg-surface px-3 text-right text-sm text-ink focus:outline-none focus:ring-2 focus:ring-[var(--btn-pay-bg)]";

// One product's prices: Algemeen (the product's own price) and one per
// topic, where empty means the site doesn't place that topic; plus "Duur".
export default function ProductPricingForm({
  websiteProductId,
  price,
  periodic,
  topics,
}: {
  websiteProductId: string;
  price: string;
  periodic: boolean;
  topics: { id: string; name: string; price: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [general, setGeneral] = useState(price);
  const [perYear, setPerYear] = useState(periodic);
  const [values, setValues] = useState<Record<string, string>>(Object.fromEntries(topics.map((t) => [t.id, t.price])));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const unit = perYear ? "per jaar" : "eenmalig";

  const row = (name: string, value: string, onChange: (v: string) => void, required = false) => {
    const on = value.trim() !== "";
    return (
      <div key={name} className="flex items-center justify-between gap-3 px-4 py-2.5">
        <span className={`text-sm ${on ? "text-ink" : "text-inkSoft"}`}>{name}</span>
        <span className="flex items-center gap-3">
          <span className={`hidden text-xs sm:inline ${on ? "text-emerald-700" : "text-inkSoft"}`}>
            {on ? "Wordt geplaatst" : "Niet geplaatst"}
          </span>
          <span className="flex items-center gap-1 text-inkSoft">
            €
            <input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="–"
              inputMode="decimal"
              required={required}
              aria-label={`Prijs ${name}`}
              className={field}
            />
          </span>
        </span>
      </div>
    );
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        startTransition(async () => {
          const r = await adminSaveProductPricingAction({
            websiteProductId,
            price: general,
            periodic: perYear,
            topics: values,
          });
          setMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: "Opgeslagen." });
          if (!r.error) router.refresh();
        });
      }}
      className="mt-3"
    >
      <div className="flex flex-wrap items-center gap-2 text-sm text-ink">
        <span className="text-inkSoft">Duur</span>
        {[
          [false, "Permanent"],
          [true, "Per jaar"],
        ].map(([value, label]) => (
          <button
            key={String(value)}
            type="button"
            onClick={() => setPerYear(value as boolean)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
              perYear === value
                ? "border-[var(--btn-pay-bg)] bg-[var(--pay-soft)] text-[var(--btn-pay-bg)]"
                : "border-line text-inkSoft hover:text-ink"
            }`}
          >
            {label as string}
          </button>
        ))}
        <span className="text-xs text-inkSoft">
          {perYear ? "De prijs is per jaar; de klant kiest 1, 2 of 3 jaar." : "Eenmalige prijs, blijft online."}
        </span>
      </div>

      <div className="mt-3 divide-y divide-line/70 rounded-lg border border-line">
        {row("Algemeen", general, setGeneral, true)}
        {topics.map((t) => row(t.name, values[t.id] ?? "", (v) => setValues((s) => ({ ...s, [t.id]: v }))))}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-inkSoft">
          Prijzen {unit}, excl. btw. Leeg = dit onderwerp wordt hier niet geplaatst.
        </span>
        <span className="flex items-center gap-3">
          {msg && <span className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</span>}
          <button
            type="submit"
            disabled={pending}
            className="btn-pay rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {pending ? "Bezig..." : "Opslaan"}
          </button>
        </span>
      </div>
    </form>
  );
}
