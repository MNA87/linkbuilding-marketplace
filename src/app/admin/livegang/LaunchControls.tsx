"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { addLaunchItemAction, cycleLaunchItemAction, deleteLaunchItemAction, setLaunchDateAction } from "./actions";

const LABELS: Record<string, string> = { todo: "te doen", busy: "bezig", done: "klaar", skip: "laten zo" };
const NEXT: Record<string, string> = { todo: "bezig", busy: "klaar", done: "te doen", skip: "te doen" };

function StatusCircle({ status }: { status: string }) {
  if (status === "done") {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--btn-pay-bg)] text-white">
        <Check size={12} strokeWidth={3} />
      </span>
    );
  }
  if (status === "busy") {
    return <span className="block h-5 w-5 rounded-full border-2 border-blue-500 bg-[linear-gradient(90deg,theme(colors.blue.500)_50%,transparent_50%)]" />;
  }
  return <span className="block h-5 w-5 rounded-full border-2 border-gray-300" />;
}

// One point: tap the circle to move it on (te doen → bezig → klaar).
export function LaunchItemRow({ id, title, status }: { id: string; title: string; status: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className={`group flex items-center gap-3 border-t border-line/70 py-2.5 ${pending ? "opacity-60" : ""}`}>
      <button
        type="button"
        onClick={() => startTransition(() => cycleLaunchItemAction(id))}
        disabled={pending}
        aria-label={`${title}: ${LABELS[status] ?? status}. Zet op ${NEXT[status] ?? "te doen"}.`}
        title={`Zet op ${NEXT[status] ?? "te doen"}`}
        className="shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--btn-pay-bg)] focus-visible:ring-offset-2"
      >
        <StatusCircle status={status} />
      </button>
      <span className={`min-w-0 flex-1 text-[14.5px] ${status === "skip" ? "text-inkSoft" : "text-ink"}`}>{title}</span>
      {status === "busy" && <span className="text-[12.5px] text-blue-700">Bezig</span>}
      {status === "skip" && <span className="text-[12.5px] text-inkSoft">Laten zo</span>}
      <button
        type="button"
        onClick={() => {
          if (confirm(`"${title}" verwijderen?`)) startTransition(() => deleteLaunchItemAction(id));
        }}
        disabled={pending}
        aria-label={`${title} verwijderen`}
        className="hidden shrink-0 px-1 text-lg leading-none text-inkSoft/60 opacity-0 hover:text-red-600 focus:opacity-100 group-hover:opacity-100 md:block"
      >
        ×
      </button>
    </div>
  );
}

export function AddLaunchItem({ list, step }: { list: "livegang" | "nice" | "algemeen"; step: number }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="border-t border-line/70 py-2.5 text-left text-[13px] text-inkSoft hover:text-ink">
        + Punt toevoegen
      </button>
    );
  }
  return (
    <form
      className="flex gap-2 border-t border-line/70 py-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const title = String(new FormData(form).get("title") ?? "").trim();
        if (title.length < 2) return;
        startTransition(async () => {
          await addLaunchItemAction({ list, step, title });
          form.reset();
          setOpen(false);
        });
      }}
    >
      <input
        name="title"
        autoFocus
        maxLength={120}
        placeholder="Nieuw punt"
        aria-label="Nieuw punt"
        className="h-9 min-w-0 flex-1 rounded-lg border border-line px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--btn-pay-bg)]"
      />
      <button type="submit" disabled={pending} className="btn-pay h-9 rounded-lg px-3.5 text-sm font-semibold disabled:opacity-60">
        Toevoegen
      </button>
      <button type="button" onClick={() => setOpen(false)} className="h-9 px-2 text-sm text-inkSoft hover:text-ink">
        Annuleren
      </button>
    </form>
  );
}

// The planned day: shown as text, "Wijzig" turns it into a date field.
export function LaunchDate({ value, label }: { value: string; label: string | null }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  if (editing) {
    return (
      <input
        type="date"
        autoFocus
        defaultValue={value}
        disabled={pending}
        aria-label="Datum livegang"
        onChange={(e) => {
          const next = e.target.value;
          startTransition(async () => {
            await setLaunchDateAction(next);
            setEditing(false);
          });
        }}
        onBlur={() => !pending && setEditing(false)}
        className="mt-1 h-9 rounded-lg border border-line px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--btn-pay-bg)]"
      />
    );
  }
  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <span className="text-lg font-semibold text-ink sm:text-[21px]">{label ?? "Nog geen datum"}</span>
      <button type="button" onClick={() => setEditing(true)} className="text-[13px] font-medium text-[var(--btn-pay-bg)] hover:underline">
        {label ? "Wijzig" : "Kies een datum"}
      </button>
    </div>
  );
}
