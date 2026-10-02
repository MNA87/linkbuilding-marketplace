"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { LAUNCH_STEPS } from "@/lib/launch";
import {
  addLaunchItemAction,
  cycleLaunchItemAction,
  deleteLaunchItemAction,
  setLaunchDateAction,
  updateLaunchItemAction,
} from "./actions";

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

// Where a point can go: a step of the livegang, Nice to have or Algemeen.
const PLACES = [
  ...LAUNCH_STEPS.map((s) => ({ value: `livegang:${s.step}`, label: `Livegang · ${s.title}` })),
  { value: "nice:0", label: "Nice to have" },
  { value: "algemeen:0", label: "Algemeen" },
];

type Row = { id: string; title: string; status: string; list: string; step: number };

// One point: tap the circle to move it on (te doen → bezig → klaar), tap the
// text to change it, move it to another list or remove it.
export function LaunchItemRow({ id, title, status, list, step }: Row) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <form
        className="flex flex-col gap-2 border-t border-line/70 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          const next = String(data.get("title") ?? "").trim();
          const [nextList, nextStep] = String(data.get("place") ?? `${list}:${step}`).split(":");
          if (next.length < 2) return;
          startTransition(async () => {
            await updateLaunchItemAction({ id, title: next, list: nextList, step: Number(nextStep) });
            setEditing(false);
          });
        }}
      >
        <input
          name="title"
          autoFocus
          defaultValue={title}
          maxLength={120}
          aria-label="Tekst"
          className="h-10 w-full rounded-lg border border-line px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--btn-pay-bg)]"
        />
        <select
          name="place"
          defaultValue={`${list}:${list === "livegang" ? step : 0}`}
          aria-label="Lijst"
          className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-[var(--btn-pay-bg)]"
        >
          {PLACES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <button type="submit" disabled={pending} className="btn-pay h-9 rounded-lg px-3.5 text-sm font-semibold disabled:opacity-60">
            Opslaan
          </button>
          <button type="button" onClick={() => setEditing(false)} className="h-9 px-2 text-sm text-inkSoft hover:text-ink">
            Annuleren
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (confirm(`"${title}" verwijderen?`)) startTransition(() => deleteLaunchItemAction(id));
            }}
            className="ml-auto h-9 px-2 text-sm text-red-600 hover:underline"
          >
            Verwijderen
          </button>
        </div>
      </form>
    );
  }
  return (
    <div className={`flex items-center gap-3 border-t border-line/70 py-2.5 ${pending ? "opacity-60" : ""}`}>
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
      <button
        type="button"
        onClick={() => setEditing(true)}
        title="Aanpassen"
        className={`min-w-0 flex-1 text-left text-[14.5px] hover:underline ${status === "skip" ? "text-inkSoft" : "text-ink"}`}
      >
        {title}
      </button>
      {status === "busy" && <span className="text-[12.5px] text-blue-700">Bezig</span>}
      {status === "skip" && <span className="text-[12.5px] text-inkSoft">Laten zo</span>}
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
