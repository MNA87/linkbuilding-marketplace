"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  createCustomerFromMailAction,
  createOrderFromMailAction,
  linkMailToCustomerAction,
  setMailStatusAction,
} from "./actions";

const field =
  "mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-[var(--btn-pay-bg)]";

export type ChooserCustomer = { id: string; company: string; email: string; orders: number };

// A mail from an address no customer has: link it to one you already have
// (the platform suggests one from the sender, or you search), or add a new
// customer (the form below). "senderEmail" is null for your own address.
export function CustomerChooser({
  mailId,
  senderEmail,
  senderLabel,
  suggestion,
  customers,
  children,
}: {
  mailId: string;
  senderEmail: string | null;
  senderLabel: string;
  suggestion: ChooserCustomer | null;
  customers: ChooserCustomer[];
  children: ReactNode;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"existing" | "new">(suggestion ? "existing" : "new");
  const [selected, setSelected] = useState<ChooserCustomer | null>(suggestion);
  const [query, setQuery] = useState("");
  const [remember, setRemember] = useState(true);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const matches = q
    ? customers.filter((c) => c.company.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)).slice(0, 6)
    : [];

  function link() {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      const r = await linkMailToCustomerAction({
        mailId,
        customerId: selected.id,
        remember: Boolean(senderEmail) && remember,
      });
      if (r.error) setError(r.error);
      else router.refresh();
    });
  }

  const tabClass = (on: boolean) =>
    `rounded-full px-3 py-1 text-[13px] font-semibold transition ${
      on ? "bg-white text-ink shadow-sm" : "text-amber-900 hover:text-ink"
    }`;

  return (
    <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
      <div className="inline-flex gap-0.5 rounded-full bg-amber-200/40 p-[3px]">
        <button type="button" onClick={() => setTab("existing")} className={tabClass(tab === "existing")}>
          Bestaande klant
        </button>
        <button type="button" onClick={() => setTab("new")} className={tabClass(tab === "new")}>
          Nieuwe klant
        </button>
      </div>

      {tab === "new" ? (
        children
      ) : (
        <div className="mt-3">
          {selected && (
            <>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-300 bg-white px-3 py-2.5">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-ink">{selected.company}</div>
                  <div className="truncate text-xs text-inkSoft">
                    {selected.email} · {selected.orders === 1 ? "1 order" : `${selected.orders} orders`}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={link}
                  disabled={pending}
                  className="btn-pay shrink-0 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
                >
                  {pending ? "Bezig..." : "Koppelen"}
                </button>
              </div>
              {selected.id === suggestion?.id && (
                <div className="mt-1.5 text-xs text-amber-900/80">
                  Voorstel op basis van de afzender: {senderLabel}.
                </div>
              )}
              {senderEmail && (
                <label className="mt-2.5 flex cursor-pointer items-start gap-2 text-[13px] text-ink">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[var(--btn-pay-bg)]"
                  />
                  <span>
                    Mails van <strong className="font-semibold">{senderEmail}</strong> voortaan ook bij{" "}
                    {selected.company}
                  </span>
                </label>
              )}
              {error && <div className="mt-2 text-sm text-red-700">{error}</div>}
            </>
          )}

          <div className={selected ? "mt-3" : ""}>
            <div className="text-xs text-amber-900/80">
              {selected ? "Niet de goede? Zoek een andere klant." : "Zoek de klant op bedrijf of e-mail."}
            </div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Zoek op bedrijf of e-mail…"
              aria-label="Klant zoeken"
              className={field}
            />
            {q && (
              <div className="mt-1 overflow-hidden rounded-lg border border-line bg-white">
                {matches.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelected(c);
                      setQuery("");
                      setError(null);
                    }}
                    className="block w-full border-t border-line/60 px-3 py-2 text-left first:border-t-0 hover:bg-gray-50"
                  >
                    <span className="text-ink">{c.company}</span>{" "}
                    <span className="text-xs text-inkSoft">· {c.email}</span>
                  </button>
                ))}
                {matches.length === 0 && <div className="px-3 py-2 text-xs text-inkSoft">Geen klant gevonden.</div>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Option B: the customer filled in from the mail, added with one click
// (in CustomerChooser's yellow box, under "Nieuwe klant").
export function NewCustomerForm({
  mailId,
  company,
  name,
  email,
  domain,
  ownWarning = false,
}: {
  mailId: string;
  company: string;
  name: string;
  email: string;
  domain: string | null;
  ownWarning?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="mt-3 text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        setError(null);
        startTransition(async () => {
          const r = await createCustomerFromMailAction({
            mailId,
            company: data.get("company"),
            name: `${String(data.get("firstName") ?? "").trim()} ${String(data.get("lastName") ?? "").trim()}`.trim(),
            email: data.get("email"),
            invoiceEmail: data.get("invoiceEmail") ?? "",
          });
          if (r.error) setError(r.error);
          else router.refresh();
        });
      }}
    >
      {ownWarning && (
        <div className="text-xs text-amber-900/80">
          Deze mail komt van je eigen adres en de klant staat er niet in. Vul de gegevens van de klant zelf in.
        </div>
      )}
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="text-xs text-amber-900/80 sm:col-span-2">
          Bedrijf
          <input name="company" defaultValue={company} required className={field} />
        </label>
        {/* The name from the mail, split: first word and the rest. */}
        <label className="text-xs text-amber-900/80">
          Voornaam
          <input name="firstName" defaultValue={name.trim().split(/\s+/)[0] ?? ""} required className={field} />
        </label>
        <label className="text-xs text-amber-900/80">
          Achternaam
          <input name="lastName" defaultValue={name.trim().split(/\s+/).slice(1).join(" ")} className={field} />
        </label>
        <label className="text-xs text-amber-900/80">
          E-mail klant
          <input name="email" type="email" defaultValue={email} required className={field} />
        </label>
        <label className="text-xs text-amber-900/80">
          Facturen naar <span className="text-amber-900/60">(optioneel, leeg = e-mail)</span>
          <input name="invoiceEmail" type="email" placeholder="boekhouding@…" className={field} />
        </label>
      </div>
      {domain && (
        <div className="mt-2 text-xs text-amber-900/80">Mails van iedereen @{domain} horen daarna bij deze klant.</div>
      )}
      <div className="mt-1 text-xs text-amber-900/80">
        Adres en btw-nummer vul je daarna meteen hier aan (via "aanvullen"); nodig vóór de verzamelfactuur.
      </div>
      {error && <div className="mt-2 text-sm text-red-700">{error}</div>}
      <button
        type="submit"
        disabled={pending}
        className="btn-pay mt-3 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
      >
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
