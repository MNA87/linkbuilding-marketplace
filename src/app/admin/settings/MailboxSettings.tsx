"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MailboxStatus } from "@/lib/mailbox";
import { deleteMailboxAction, saveMailboxAction, testMailboxAction } from "./actions";

type Result = { ok: boolean; message: string };

// The mailbox customers send their orders to; the platform reads it every
// few minutes (Admin → Binnengekomen). The password is only ever typed in.
export default function MailboxSettings({ status }: { status: MailboxStatus }) {
  const router = useRouter();
  const [editing, setEditing] = useState(!status.configured);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setBusy(true);
    setResult(null);
    const r = await saveMailboxAction({
      host: data.get("host"),
      user: data.get("user"),
      password: data.get("password"),
    }).catch(() => ({ ok: false, message: "Opslaan mislukt." }));
    setBusy(false);
    setResult(r);
    if (r.ok) {
      setEditing(false);
      router.refresh();
    }
  }

  async function test() {
    setBusy(true);
    setResult(null);
    setResult(await testMailboxAction().catch(() => ({ ok: false, message: "Testen mislukt." })));
    setBusy(false);
  }

  async function remove() {
    if (!confirm("Mailbox loskoppelen? Er worden dan geen mails meer opgehaald.")) return;
    setBusy(true);
    await deleteMailboxAction().catch(() => null);
    setBusy(false);
    setResult(null);
    setEditing(true);
    router.refresh();
  }

  const field = "mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand";

  return (
    <div className="bg-surface border border-line rounded-lg p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-ink">Mailbox voor bestellingen</p>
          <p className="text-sm text-inkSoft mt-0.5">
            Mails aan dit adres komen binnen bij Binnengekomen, met de Word-bijlage al ingelezen.
          </p>
        </div>
        {status.configured && !editing && (
          <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Ingesteld</span>
        )}
      </div>

      {status.unreadable && (
        <p className="mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          De opgeslagen inlog kan niet meer gelezen worden. Vul hem opnieuw in.
        </p>
      )}

      {!editing && status.configured ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded-md border border-line bg-gray-50 px-3 py-2 text-sm text-ink">
            {status.user} <span className="text-inkSoft">· {status.host}</span>
          </span>
          <button
            type="button"
            onClick={test}
            disabled={busy}
            className="rounded-md border border-line px-3 py-2 text-sm text-ink hover:bg-gray-50 disabled:opacity-50"
          >
            {busy ? "Bezig..." : "Test verbinding"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-md border border-line px-3 py-2 text-sm text-ink hover:bg-gray-50"
          >
            Wijzigen
          </button>
          <button type="button" onClick={remove} disabled={busy} className="px-2 py-2 text-sm text-red-600 hover:underline disabled:opacity-50">
            Loskoppelen
          </button>
        </div>
      ) : (
        <form onSubmit={save} className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="text-xs text-inkSoft">
            Server (IMAP)
            <input name="host" defaultValue={status.host ?? ""} placeholder="gukm1234.siteground.biz" required spellCheck={false} className={field} />
          </label>
          <label className="text-xs text-inkSoft">
            E-mailadres
            <input name="user" type="email" defaultValue={status.user ?? ""} placeholder="seo@mnamediainvest.nl" required className={field} />
          </label>
          <label className="text-xs text-inkSoft">
            Wachtwoord
            <input name="password" type="password" autoComplete="new-password" required className={field} />
          </label>
          <p className="text-xs text-inkSoft sm:col-span-3">
            De server vind je in SiteGround: Site Tools → E-mail → Accounts → ⋮ bij het adres → Mail configuration
            (bij IMAP, poort 993).
          </p>
          <div className="flex items-center gap-2 sm:col-span-3">
            <button type="submit" disabled={busy} className="btn-primary rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50">
              {busy ? "Verbinden..." : "Opslaan en testen"}
            </button>
            {status.configured && (
              <button type="button" onClick={() => setEditing(false)} className="px-2 py-2 text-sm text-inkSoft hover:text-ink">
                Annuleren
              </button>
            )}
          </div>
        </form>
      )}

      {result && (
        <p className={`mt-3 text-sm ${result.ok ? "text-emerald-700" : "text-red-600"}`}>{result.message}</p>
      )}
    </div>
  );
}
