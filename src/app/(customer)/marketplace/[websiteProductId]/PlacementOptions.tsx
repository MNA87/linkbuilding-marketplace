"use client";

import { DURATION_YEARS, durationLabel, MAX_SCHEDULE_DAYS } from "@/lib/placementPeriod";
import { useState } from "react";
import DatePicker from "@/components/DatePicker";

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
}: {
  publishOn: string;
  durationYears: number;
  onPublishOnChange: (value: string) => void;
  onDurationYearsChange: (value: number) => void;
  yearlyPrice: number;
  scheduleMin: string;
  scheduleMax: string;
  inputClass: string;
}) {
  const planned = publishOn !== "";
  // Only a click on "Op een datum" opens the calendar by itself — not an
  // item that was already planned when the form loaded.
  const [justPlanned, setJustPlanned] = useState(false);

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
                setJustPlanned(isPlanned && !planned);
                onPublishOnChange(isPlanned ? publishOn || scheduleMin : "");
              }}
              className={`rounded px-2 py-1.5 text-sm transition-colors ${
                planned === isPlanned ? "bg-brandSoft text-ink font-medium" : "text-inkSoft hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {planned && (
          <div className="mt-2">
            <DatePicker
              id="publishOn"
              value={publishOn}
              min={scheduleMin}
              max={scheduleMax}
              onChange={onPublishOnChange}
              initiallyOpen={justPlanned}
            />
          </div>
        )}
        <p className="text-xs text-inkSoft mt-1">
          {planned
            ? `Gaat die dag 's ochtends online. Maximaal ${MAX_SCHEDULE_DAYS} dagen vooruit.`
            : "Gaat online zodra de betaling rond is."}
        </p>
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
