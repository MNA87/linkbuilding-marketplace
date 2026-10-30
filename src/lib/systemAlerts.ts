import { prisma } from "@/lib/prisma";
import { sendSystemAlertEmail } from "@/lib/email";

// Mails to the admins when something on the platform keeps going wrong:
// the background jobs (mail fetching, "staat live" mails, reminders,
// planned publishing) and errors on pages. Few mails, but nothing serious
// missed:
// - a job that fails once (a mail server briefly away) mails nothing; only
//   when it keeps failing (see FAIL_AFTER) does one mail go out, again at
//   most every REPEAT_HOURS while it lasts, and one "werkt weer" after;
// - an error on a page mails at once, at most once per page per PAGE_HOURS;
// - never more than DAILY_CAP mails a day in all;
// - switched off altogether in Instellingen → Systeem, if need be.
// Kept in the database (SiteSettings.alertState), so an update, which
// restarts the server, doesn't start the counting afresh.

const HOUR_MS = 3_600_000;
const REPEAT_HOURS = 12;
const PAGE_HOURS = 6;
const DAILY_CAP = 10;

// Failures in a row before it counts as a problem, per job: often-running
// jobs get more room for a passing hiccup.
export const FAIL_AFTER: Record<string, number> = {
  "Mail ophalen": 5, // every 3 minutes: about a quarter of an hour
  '"Staat live"-mails': 5, // every minute
};
const DEFAULT_FAIL_AFTER = 2; // the hourly jobs: two hours

type JobState = { failures: number; since: number; alertedAt: number | null; lastError: string };

export type AlertState = {
  jobs: Record<string, JobState>;
  pages: Record<string, number>;
  sent: number[]; // when each alert mail went out, for the daily cap
};

export const newAlertState = (): AlertState => ({ jobs: {}, pages: {}, sent: [] });

type Mail = { subject: string; message: string };

const message = (err: unknown) => (err instanceof Error ? err.message : String(err)).slice(0, 300);
const time = (ms: number) =>
  new Date(ms).toLocaleString("nl-NL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Amsterdam",
  });

function underCap(state: AlertState, now: number): boolean {
  state.sent = state.sent.filter((t) => now - t < 24 * HOUR_MS);
  if (state.sent.length >= DAILY_CAP) return false;
  state.sent.push(now);
  return true;
}

// A job failed: the mail to send now, if any.
export function jobFailedMail(state: AlertState, job: string, err: unknown, now: number): Mail | null {
  const s = state.jobs[job] ?? { failures: 0, since: now, alertedAt: null, lastError: "" };
  s.failures += 1;
  s.lastError = message(err);
  state.jobs[job] = s;
  if (s.failures < (FAIL_AFTER[job] ?? DEFAULT_FAIL_AFTER)) return null;
  if (s.alertedAt !== null && now - s.alertedAt < REPEAT_HOURS * HOUR_MS) return null;
  if (!underCap(state, now)) return null;
  const again = s.alertedAt !== null;
  s.alertedAt = now;
  return {
    subject: again ? `Nog steeds: ${job} lukt niet` : `Probleem: ${job} lukt niet`,
    message:
      `${job} lukt sinds ${time(s.since)} niet (${s.failures} keer achter elkaar). ` +
      `Het platform blijft het vanzelf opnieuw proberen. Foutmelding: ${s.lastError}`,
  };
}

// A job went well: a "werkt weer" mail if we had warned about it.
export function jobOkMail(state: AlertState, job: string, now: number): Mail | null {
  const s = state.jobs[job];
  delete state.jobs[job];
  if (!s?.alertedAt || !underCap(state, now)) return null;
  return { subject: `Opgelost: ${job} werkt weer`, message: `${job} werkt weer sinds ${time(now)}.` };
}

// Not a fault: the visitor closed the page or went on before it had loaded,
// or a bot/stale prefetch POSTs a bogus body to an RSC/server-action path
// ("Failed to parse body as FormData").
const NOISE = [
  /destination stream closed early/i,
  /aborted/i,
  /ECONNRESET/,
  /Failed to parse body as FormData/i,
];

export function pageErrorMail(state: AlertState, path: string, err: unknown, now: number): Mail | null {
  const text = message(err);
  if (NOISE.some((r) => r.test(text))) return null;
  const last = state.pages[path];
  if (last !== undefined && now - last < PAGE_HOURS * HOUR_MS) return null;
  if (!underCap(state, now)) return null;
  state.pages[path] = now;
  return {
    subject: `Fout op een pagina: ${path}`,
    message: `Op ${path} ging om ${time(now)} iets mis. Foutmelding: ${text}`,
  };
}

// ---- Sending ----

// Read from the database once per server start, then kept in memory and
// written back on every change.
const g = globalThis as typeof globalThis & { __nugevondenAlerts?: Promise<AlertState> };

function load(): Promise<AlertState> {
  return (g.__nugevondenAlerts ??= prisma.siteSettings
    .findUnique({ where: { id: 1 }, select: { alertState: true } })
    .then((row) => ({ ...newAlertState(), ...((row?.alertState ?? {}) as Partial<AlertState>) }))
    .catch(() => newAlertState()));
}

async function save(state: AlertState): Promise<void> {
  // Pages not seen for a day are forgotten, so the list stays short.
  const now = Date.now();
  for (const [path, at] of Object.entries(state.pages)) if (now - at > 24 * HOUR_MS) delete state.pages[path];
  await prisma.siteSettings
    .update({ where: { id: 1 }, data: { alertState: state } })
    .catch((err) => console.error("systeemmeldingen: stand bewaren mislukt", err));
}

// Switched off in Instellingen → Systeem: nothing is counted or mailed.
async function enabled(): Promise<boolean> {
  const row = await prisma.siteSettings
    .findUnique({ where: { id: 1 }, select: { alertMailsEnabled: true } })
    .catch(() => null);
  return row?.alertMailsEnabled ?? true;
}

async function send(mail: Mail | null): Promise<void> {
  if (!mail || !(await enabled())) return;
  try {
    const admins = await prisma.user.findMany({ where: { role: { name: "admin" } }, select: { email: true } });
    for (const { email } of admins) await sendSystemAlertEmail(email, mail.subject, mail.message);
  } catch (err) {
    console.error("systeemmelding versturen mislukt", err);
  }
}

export async function jobFailed(job: string, err: unknown): Promise<void> {
  console.error(`${job} mislukt`, err);
  if (!(await enabled())) return;
  const state = await load();
  const mail = jobFailedMail(state, job, err, Date.now());
  await save(state);
  await send(mail);
}

// Called after every successful run: only touches the database when the
// job had failed before.
export async function jobOk(job: string): Promise<void> {
  const state = await load();
  if (!state.jobs[job]) return;
  const mail = jobOkMail(state, job, Date.now());
  await save(state);
  await send(mail);
}

export async function pageError(path: string, err: unknown): Promise<void> {
  if (!(await enabled())) return;
  const state = await load();
  const mail = pageErrorMail(state, path, err, Date.now());
  if (mail) await save(state);
  await send(mail);
}
