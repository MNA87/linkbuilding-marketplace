"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCustomerFromMailAction, createOrderFromMailAction, setMailStatusAction } from "./actions";

const field =
  "mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-[var(--btn-pay-bg)]";

// Option B: the customer filled in from the mail, added with one click.
export function NewCustomerForm({
  mailId,
  company,
  name,
  email,
  domain,
}: {
  mailId: string;
  company: string;
  name: string;
  email: string;
  domain: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        setError(null);
        startTransition(async () => {
          const r = await createCustomerFromMailAction({
            mailId,
            company: data.get("company"),
            name: data.get("name"),
            email: data.get("email"),
          });
          if (r.error) setError(r.error);
          else router.refresh();
        });
      }}
    >
      <div className="font-semibold text-amber-900">Nieuwe klant</div>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <label className="text-xs text-amber-900/80">
          Bedrijf
          <input name="company" defaultValue={company} required className={field} />
        </label>
        <label className="text-xs text-amber-900/80">
          Naam
          <input name="name" defaultValue={name} required className={field} />
        </label>
        <label className="text-xs text-amber-900/80">
          E-mail
          <input name="email" type="email" defaultValue={email} required className={field} />
        </label>
      </div>
      {domain && (
        <div className="mt-2 text-xs text-amber-900/80">Mails van iedereen @{domain} horen daarna bij deze klant.</div>
      )}
      {error && <div className="mt-2 text-sm text-red-700">{error}</div>}
      <button type="submit" disabled={pending} className="btn-pay mt-3 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60">
        {pending ? "Bezig..." : "Klant aanmaken"}
      </button>
    </form>
  );
}

// Choose the site (filled in when the mail named one) and make the order.
export function CreateOrderForm({
  mailId,
  websites,
  websiteId,
  canOrder,
  writeForMe,
  writingFee,
}: {
  mailId: string;
  websites: { id: string; domain: string; price: string; note: string | null }[];
  websiteId: string | null;
  canOrder: boolean;
  writeForMe: boolean;
  // Null: writing is included in this customer's prices.
  writingFee: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [site, setSite] = useState(websiteId ?? "");
  const [error, setError] = useState<string | null>(null);
  const chosen = websites.find((w) => w.id === site);
  return (
    <div className="mt-3">
      <label className="text-xs text-inkSoft">
        Website
        <select value={site} onChange={(e) => setSite(e.target.value)} className={field}>
          <option value="">Kies een website…</option>
          {websites.map((w) => (
            <option key={w.id} value={w.id}>
              {w.domain}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2 text-sm">
        <span className="text-inkSoft">Betalen</span>
        <span className="text-right text-ink">
          Op rekening · verzamelfactuur
          {chosen && (
            <>
              {` · ${chosen.price}`}
              {chosen.note && <span className="text-inkSoft"> ({chosen.note})</span>}
              {writeForMe && (writingFee ? ` + ${writingFee} schrijven` : " · schrijven inbegrepen")}
            </>
          )}
        </span>
      </div>
      {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => setMailStatusAction(mailId, "ignored"))}
          className="rounded-lg border border-line bg-surface px-4 py-2 text-sm text-ink hover:bg-gray-50 disabled:opacity-60"
        >
          Negeren
        </button>
        <button
          type="button"
          disabled={pending || !canOrder || !site}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const r = await createOrderFromMailAction({ mailId, websiteId: site });
              if (r.error) setError(r.error);
              else router.push(`/admin/orders/${r.orderItemId}`);
            });
          }}
          className="btn-pay rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {pending ? "Bezig..." : "Order aanmaken"}
        </button>
      </div>
      {!canOrder && <div className="mt-1 text-right text-xs text-inkSoft">Eerst de klant aanmaken.</div>}
    </div>
  );
}
