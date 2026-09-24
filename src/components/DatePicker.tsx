"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

// Days are plain "YYYY-MM-DD" strings throughout (compared as strings, built
// in UTC), so the calendar never shifts a day with the viewer's time zone.
function toDay(year: number, month: number, date: number): string {
  return new Date(Date.UTC(year, month, date)).toISOString().slice(0, 10);
}

function parts(day: string): { year: number; month: number } {
  return { year: Number(day.slice(0, 4)), month: Number(day.slice(5, 7)) - 1 };
}

const monthLabel = new Intl.DateTimeFormat("nl-NL", { month: "long", year: "numeric", timeZone: "UTC" });
const longLabel = new Intl.DateTimeFormat("nl-NL", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const WEEKDAYS = ["ma", "di", "wo", "do", "vr", "za", "zo"];

export function formatDay(day: string): string {
  return longLabel.format(new Date(`${day}T12:00:00Z`));
}

// A month calendar that only lets you pick days between min and max —
// anything outside is shown greyed out and can't be clicked.
export default function DatePicker({
  id,
  value,
  min,
  max,
  onChange,
  placeholder = "Kies een datum",
  initiallyOpen = false,
}: {
  id?: string;
  value: string;
  min: string;
  max: string;
  onChange: (day: string) => void;
  placeholder?: string;
  // Open straight away, e.g. right after the customer chose "Op een datum".
  initiallyOpen?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const [view, setView] = useState(() => parts(value || min));
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function toggle() {
    if (!open) setView(parts(value || min));
    setOpen((o) => !o);
  }

  const first = new Date(Date.UTC(view.year, view.month, 1));
  const daysInMonth = new Date(Date.UTC(view.year, view.month + 1, 0)).getUTCDate();
  const leading = (first.getUTCDay() + 6) % 7; // Monday first
  const minView = parts(min);
  const maxView = parts(max);
  const canPrev = view.year * 12 + view.month > minView.year * 12 + minView.month;
  const canNext = view.year * 12 + view.month < maxView.year * 12 + maxView.month;
  const shift = (by: number) => {
    const d = new Date(Date.UTC(view.year, view.month + by, 1));
    setView({ year: d.getUTCFullYear(), month: d.getUTCMonth() });
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        id={id}
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 border border-line rounded-md px-3 py-2 text-sm text-left bg-surface hover:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
      >
        <span className={value ? "text-ink" : "text-inkSoft"}>{value ? formatDay(value) : placeholder}</span>
        <CalendarDays size={16} className="shrink-0 text-inkSoft" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Kies een datum"
          className="absolute right-0 z-30 mt-1 w-[17rem] max-w-[calc(100vw-2rem)] rounded-lg border border-line bg-surface p-3 shadow-lg"
        >
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => shift(-1)}
              disabled={!canPrev}
              aria-label="Vorige maand"
              className="p-1 rounded-md text-inkSoft hover:bg-brandSoft hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium text-ink capitalize">{monthLabel.format(first)}</span>
            <button
              type="button"
              onClick={() => shift(1)}
              disabled={!canNext}
              aria-label="Volgende maand"
              className="p-1 rounded-md text-inkSoft hover:bg-brandSoft hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center">
            {WEEKDAYS.map((w) => (
              <span key={w} className="text-[11px] uppercase tracking-wide text-inkSoft py-1">
                {w}
              </span>
            ))}
            {Array.from({ length: leading }, (_, i) => (
              <span key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = toDay(view.year, view.month, i + 1);
              const disabled = day < min || day > max;
              const selected = day === value;
              return (
                <button
                  key={day}
                  type="button"
                  disabled={disabled}
                  aria-label={formatDay(day)}
                  aria-pressed={selected}
                  onClick={() => {
                    onChange(day);
                    setOpen(false);
                  }}
                  className={`h-8 rounded-md text-sm tabular-nums transition-colors ${
                    selected
                      ? "bg-brand text-white font-medium"
                      : disabled
                        ? "text-inkSoft/40 cursor-not-allowed"
                        : "text-ink hover:bg-brandSoft"
                  }`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>

          <p className="mt-2 text-xs text-inkSoft">Te kiezen van morgen tot uiterlijk {formatDay(max)}.</p>
        </div>
      )}
    </div>
  );
}
