import { z } from "zod";

// How long a placement stays online (1-3 years). The marketplace price is per year; a
// longer period costs that yearly price x the number of years.
export const DURATION_YEARS = [1, 2, 3] as const;

// What "Periode" starts on for a new item.
export const DEFAULT_DURATION_YEARS = 1;

// "Wanneer online?" can be planned at most this many days ahead.
export const MAX_SCHEDULE_DAYS = 365;

// Reminder email this many days before a placement's period ends.
export const REMINDER_DAYS_BEFORE = 30;

type Amount = { mul(n: number): Amount; div(n: number): Amount };

export function priceForYears<T extends Amount>(yearlyPrice: T, years: number): T {
  return yearlyPrice.mul(years) as T;
}

// Back from an item's snapshot (already x durationYears) to the price per year.
export function yearlyPrice<T extends Amount>(periodPrice: T, years: number): T {
  return periodPrice.div(years) as T;
}

export function addYears(date: Date, years: number): Date {
  const d = new Date(date);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d;
}

export function durationLabel(years: number): string {
  return years === 1 ? "1 jaar" : `${years} jaar`;
}

// Calendar day ("YYYY-MM-DD") in the Netherlands, whatever the zone of the
// server or browser. Built from the separate parts: a locale's whole-date
// format (en-CA and the like) isn't the same in every browser.
const amsterdamParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Amsterdam",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function amsterdamDay(date: Date): string {
  const parts = amsterdamParts.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function addDays(day: string, days: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// The earliest and latest day a customer can pick.
export function scheduleBounds(now = new Date()): { min: string; max: string } {
  const today = amsterdamDay(now);
  return { min: addDays(today, 1), max: addDays(today, MAX_SCHEDULE_DAYS) };
}

// A planned day goes out early that morning (06:00 UTC = 07:00/08:00 NL).
export function publishAtFromDay(day: string): Date {
  return new Date(`${day}T06:00:00Z`);
}

// "" = direct; otherwise a day between tomorrow and a year from now.
export function publishOnSchema(now = new Date()) {
  return z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Ongeldige datum")
    .refine((v) => {
      if (v === "") return true;
      const { min, max } = scheduleBounds(now);
      return v >= min && v <= max && !Number.isNaN(publishAtFromDay(v).getTime());
    }, `Kies een datum vanaf morgen tot maximaal ${MAX_SCHEDULE_DAYS} dagen vooruit`);
}

export const durationYearsSchema = z.coerce
  .number()
  .int()
  .refine((n) => (DURATION_YEARS as readonly number[]).includes(n), "Kies een looptijd van 1 tot 3 jaar");

// For form schemas: checked against the current date at validation time,
// not when the schema object was created.
export const publishOnField = z
  .string()
  .default("")
  .superRefine((value, ctx) => {
    const result = publishOnSchema().safeParse(value);
    if (!result.success) ctx.addIssue({ code: "custom", message: result.error.issues[0]?.message ?? "Ongeldige datum" });
  });

const nlDate = (d: Date) => d.toLocaleDateString("nl-NL", { timeZone: "Europe/Amsterdam" });

// One line about an item's period for order overviews, e.g.
// "Periode: 2 jaar · loopt tot 24-9-2028" or "+1 jaar" for a renewal.
export function placementDetails(item: {
  durationYears: number;
  publishAt: Date | null;
  renewsOrderItemId: string | null;
  placement: { liveUrl: string | null; expiresAt: Date | null; status: string } | null;
}): string {
  if (item.renewsOrderItemId) return `Verlenging: +${durationLabel(item.durationYears)}`;
  const parts = [`Periode: ${durationLabel(item.durationYears)}`];
  if (item.placement?.status === "expired") parts.push("verlopen");
  else if (item.placement?.expiresAt) parts.push(`loopt tot ${nlDate(item.placement.expiresAt)}`);
  else if (item.publishAt && !item.placement?.liveUrl) parts.push(`gaat online op ${nlDate(item.publishAt)}`);
  return parts.join(" · ");
}

// A saved choice can be out of date: an older draft or item may carry a
// period that's no longer offered, or a planned day that has since passed.
// Bring it back within what can be picked now, instead of letting the form
// refuse to save over something the customer can't even see.
export function sanitizePlacementChoice(
  choice: { publishOn?: unknown; durationYears?: unknown },
  bounds: { min: string; max: string }
): { publishOn: string; durationYears: number } {
  const years = Number(choice.durationYears);
  const durationYears = (DURATION_YEARS as readonly number[]).includes(years) ? years : DEFAULT_DURATION_YEARS;
  let publishOn = typeof choice.publishOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(choice.publishOn) ? choice.publishOn : "";
  if (publishOn && publishOn < bounds.min) publishOn = bounds.min;
  if (publishOn && publishOn > bounds.max) publishOn = bounds.max;
  return { publishOn, durationYears };
}
