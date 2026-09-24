"use client";

import { DURATION_YEARS, durationLabel, MAX_SCHEDULE_DAYS } from "@/lib/placementPeriod";

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

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm text-ink mb-1" htmlFor="publishMode">
          Wanneer online?
        </label>
        <select
          id="publishMode"
          value={planned ? "date" : "direct"}
          onChange={(e) => onPublishOnChange(e.target.value === "date" ? scheduleMin : "")}
          className={inputClass}
        >
          <option value="direct">Direct na betaling</option>
          <option value="date">Op een datum</option>
        </select>
        {planned && (
          <input
            id="publishOn"
            type="date"
            required
            min={scheduleMin}
            max={scheduleMax}
            value={publishOn}
            onChange={(e) => onPublishOnChange(e.target.value)}
            className={`${inputClass} mt-2`}
          />
        )}
        <p className="text-xs text-inkSoft mt-1">
          {planned
            ? `Gaat die dag 's ochtends online (maximaal ${MAX_SCHEDULE_DAYS} dagen vooruit).`
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
        <p className="text-xs text-inkSoft mt-1">
          Na deze periode gaat de plaatsing offline, tenzij je verlengt. Je krijgt vooraf een herinnering.
        </p>
      </div>
    </div>
  );
}
