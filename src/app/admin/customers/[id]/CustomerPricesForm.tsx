"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveCustomerPricesAction } from "../actions";

export type PriceRow = { id: string; domain: string; product: string; standard: number; fixed: string };

const field =
  "rounded-lg border border-line bg-surface px-3 py-1.5 text-right text-sm text-ink focus:outline-none focus:ring-2 focus:ring-[var(--btn-pay-bg)]";
const euro = (n: number) => `€${n.toFixed(2).replace(".", ",")}`;
const num = (v: string) => Number(v.replace(/\s|€/g, "").replace(",", "."));

// The customer's prices: a discount on all sites, a fixed price per row that
// goes before it, and whether writing is included. "Klant betaalt" follows
// what you type.
export default function CustomerPricesForm({
  companyId,
  rows,
  discount,
  writingIncluded,
  writingPrice,
}: {
  companyId: string;
  rows: PriceRow[];
  discount: string;
  writingIncluded: boolean;
  writingPrice: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pct, setPct] = useState(discount);
  const [included, setIncluded] = useState(writingIncluded);
  const [fixed, setFixed] = useState<Record<string, string>>(Object.fromEntries(rows.map((r) => [r.id, r.fixed])));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const d = num(pct) > 0 && num(pct) <= 100 ? num(pct) : 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        startTransition(async () => {
          const r = await saveCustomerPricesAction({
            companyId,
            discountPercent: pct,
            writingIncluded: included,
            fixed,
          });
          setMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: "Opgeslagen. Geldt voor nieuwe orders." });
          if (!r.error) router.refresh();
        });
      }}
    >
      <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-ink">
        <label className="flex items-center gap-2">
          Korting op alle sites
          <input
            value={pct}
            onChange={(e) => setPct(e.target.value)}
            placeholder="0"
            inputMode="decimal"
            className={`${field} w-20`}
          />
          %
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={included}
            onChange={(e) => setIncluded(e.target.checked)}
            className="h-4 w-4"
          />
          Schrijven zit in de prijs
          <span className="text-inkSoft">({included ? "geen schrijfkosten" : `anders + ${euro(writingPrice)}`})</span>
        </label>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-inkSoft">
            <tr>
              <th className="px-4 py-2 font-medium">Website</th>
              <th className="px-4 py-2 font-medium">Soort</th>
              <th className="px-4 py-2 text-right font-medium">Standaard</th>
              <th className="px-4 py-2 font-medium">Vaste prijs</th>
              <th className="px-4 py-2 text-right font-medium">Klant betaalt</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const f = fixed[r.id]?.trim();
              const isFixed = Boolean(f) && !Number.isNaN(num(f));
              const pays = isFixed ? num(f) : Math.round(r.standard * (100 - d)) / 100;
              return (
                <tr key={r.id} className="border-t border-line/70">
                  <td className="px-4 py-2.5 text-ink">{r.domain}</td>
                  <td className="px-4 py-2.5 text-ink/80">{r.product}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-inkSoft">{euro(r.standard)}</td>
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-1 text-inkSoft">
                      €
                      <input
                        value={fixed[r.id] ?? ""}
                        onChange={(e) => setFixed({ ...fixed, [r.id]: e.target.value })}
                        placeholder="–"
                        inputMode="decimal"
                        aria-label={`Vaste prijs ${r.domain} ${r.product}`}
                        className={`${field} w-24`}
                      />
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">
                    <span className="font-medium text-ink">{euro(pays)}</span>
                    <span className="block text-xs text-inkSoft">
                      {isFixed ? "vaste prijs" : d > 0 ? `${pct.trim()}% korting` : "standaard"}
                    </span>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-inkSoft">
                  Nog geen sites in het aanbod.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-end gap-3">
        {msg && <span className={`text-sm ${msg.ok ? "text-inkSoft" : "text-red-600"}`}>{msg.text}</span>}
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
