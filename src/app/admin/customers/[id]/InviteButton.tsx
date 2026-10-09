"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { inviteCustomerAction } from "../actions";

// "Uitnodigen" (or "Opnieuw sturen" once invited): the customer gets a link
// to choose a password and order online.
export default function InviteButton({ companyId, again }: { companyId: string; again: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const invite = () =>
    startTransition(async () => {
      const r = await inviteCustomerAction(companyId);
      setMessage(r.error ? { ok: false, text: r.error } : { ok: true, text: r.message ?? "Verstuurd." });
      if (!r.error) router.refresh();
    });
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={invite}
        className={
          again
            ? "rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink hover:bg-gray-50 disabled:opacity-60"
            : "btn-pay rounded-lg px-3.5 py-1.5 text-sm font-semibold disabled:opacity-60"
        }
      >
        {pending ? "Versturen…" : again ? "Opnieuw sturen" : "Uitnodigen"}
      </button>
      {message && <span className={`text-sm ${message.ok ? "text-emerald-700" : "text-red-600"}`}>{message.text}</span>}
    </>
  );
}
