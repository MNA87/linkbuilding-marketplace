import { z } from "zod";

// How long a placement stays online. The marketplace price is per year; a
// longer period costs that yearly price x the number of years.
export const DURATION_YEARS = [1, 2, 3, 4, 5] as const;

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

// Calendar day ("YYYY-MM-DD") in the Netherlands, whatever the server's zone.
export function amsterdamDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" }).format(date);
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
  .refine((n) => (DURATION_YEARS as readonly number[]).includes(n), "Kies een looptijd van 1 tot 5 jaar");

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
