"use client";

import { useState } from "react";
import { DURATION_YEARS, durationLabel } from "@/lib/placementPeriod";
import DatePicker, { formatDay } from "@/components/DatePicker";

// "Wanneer online?" and "Periode" — shared by the blog and homepage-link
// order forms. The price per option is the yearly price x years (excl. VAT).
export default function PlacementOptions({
  publishOn,
  durationYears,
  onPublishOnChange,
  onDurationYearsChange,
  yearlyPrice,
  scheduleMin,
  scheduleMax,
  inputClass,
  directNote = "Gaat online zodra de betaling rond is.",
}: {
  publishOn: string;
  durationYears: number;
  onPublishOnChange: (value: string) => void;
  onDurationYearsChange: (value: number) => void;
  yearlyPrice: number;
  scheduleMin: string;
  scheduleMax: string;
  inputClass: string;
  directNote?: string;
}) {
  const planned = publishOn !== "";
  // The calendar opens on choosing "Op een datum" and folds away once a day
  // is picked, leaving just the chosen day (with a way to change it).
  const [calendarOpen, setCalendarOpen] = useState(false);

  return (
    <div className="space-y-5">
      <div>
        <span className="block text-sm text-ink mb-1">Wanneer online?</span>
        <div role="radiogroup" aria-label="Wanneer online?" className="grid grid-cols-2 rounded-md border border-line p-0.5">
          {(
            [
              [false, "Direct"],
              [true, "Op een datum"],
            ] as const
          ).map(([isPlanned, label]) => (
            <button
              key={label}
              type="button"
              role="radio"
              aria-checked={planned === isPlanned}
              onClick={() => {
                onPublishOnChange(isPlanned ? publishOn || scheduleMin : "");
                setCalendarOpen(isPlanned);
              }}
              className={`rounded px-2 py-1.5 text-sm transition-colors ${
                planned === isPlanned ? "bg-brandSoft text-ink font-medium" : "text-inkSoft hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {planned && calendarOpen && (
          <div className="mt-2">
            <DatePicker
              id="publishOn"
              value={publishOn}
              min={scheduleMin}
              max={scheduleMax}
              onChange={(day) => {
                onPublishOnChange(day);
                setCalendarOpen(false);
              }}
              inline
              footer={publishOn ? `Gaat online op ${formatDay(publishOn)}, 's ochtends.` : null}
            />
          </div>
        )}
        {planned && !calendarOpen && (
          <div className="mt-2 flex items-start justify-between gap-2 rounded-md border border-line px-3 py-2 text-sm">
            <span className="text-ink">
              Gaat online op <strong className="font-medium">{formatDay(publishOn)}</strong>, &apos;s ochtends.
            </span>
            <button
              type="button"
              onClick={() => setCalendarOpen(true)}
              className="shrink-0 text-brand hover:underline"
            >
              Wijzig
            </button>
          </div>
        )}
        {!planned && <p className="text-xs text-inkSoft mt-1">{directNote}</p>}
      </div>

      <div>
        <label className="block text-sm text-ink mb-1" htmlFor="durationYears">
          Periode
        </label>
        <select
          id="durationYears"
          value={durationYears}
          onChange={(e) => onDurationYearsChange(Number(e.target.value))}
          className={inputClass}
        >
          {DURATION_YEARS.map((years) => (
            <option key={years} value={years}>
              {durationLabel(years)} — €{(yearlyPrice * years).toFixed(2)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
