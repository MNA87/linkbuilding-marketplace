"use client";

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
              onClick={() => onPublishOnChange(isPlanned ? publishOn || scheduleMin : "")}
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
              inline
              footer={publishOn ? `Gaat online op ${formatDay(publishOn)}, 's ochtends.` : null}
            />
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
