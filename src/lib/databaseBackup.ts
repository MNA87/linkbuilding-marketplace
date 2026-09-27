import { gunzipSync, gzipSync } from "node:zlib";
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { Prisma } from "@prisma/client";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { prisma } from "@/lib/prisma";
import { storageClient, storageConfigured as targetConfigured } from "@/lib/storage";
import { sendSystemAlertEmail } from "@/lib/email";

// Our own database backups, since Railway's volume backups need the Pro plan:
// every hour a full copy of every table, gzipped JSON, into the storage
// bucket (outside the database's own volume). Restoring is a deliberate,
// manual step: scripts/restore-backup.ts.

export const BACKUP_PREFIX = "database-backups/";
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
// Every copy of the last 48 hours, then the first copy of each day for 14 days.
export const KEEP_ALL_HOURS = 48;
export const KEEP_DAILY_DAYS = 14;
// No successful copy for this long means something is wrong: mail the admins.
export const ALERT_AFTER_HOURS = 2;

// A copy made right before a restore carries this label, so the way back
// stays recognisable and "the latest copy" never means that one.
export const SAFETY_LABEL = "voorterugzetten";

export type BackupObject = { key: string; size: number; createdAt: Date; label?: string };

// The database copies go to their own bucket (BACKUP_STORAGE_*), apart from
// customers' uploads; without one they share the uploads bucket.
const backupStorage = () => storageClient("backups");

export function storageConfigured(): boolean {
  return targetConfigured("backups");
}

// "database-backups/2026-09-27T08-00-12Z.json.gz" (optionally with a label
// before .json.gz); the time is in the name so the list sorts by it and
// retention needs no extra lookups.
export function backupKey(at: Date, label?: string): string {
  const stamp = at.toISOString().slice(0, 19).replace(/:/g, "-");
  return `${BACKUP_PREFIX}${stamp}Z${label ? `-${label}` : ""}.json.gz`;
}

const KEY_PATTERN = /^database-backups\/(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})Z(?:-([a-z]+))?\.json\.gz$/;

export function backupTime(key: string): Date | null {
  const m = key.match(KEY_PATTERN);
  return m ? new Date(`${m[1]}T${m[2]}:${m[3]}:${m[4]}Z`) : null;
}

export function backupLabel(key: string): string | undefined {
  return key.match(KEY_PATTERN)?.[5];
}

const quote = (name: string) => `"${name.replace(/"/g, '""')}"`;

// Every table (and the migrations table) as one consistent snapshot: the
// reads share one repeatable-read transaction, so an order and its items
// can't come from different moments. Rows stay as the JSON text Postgres
// produces, so numbers and dates are copied exactly.
export async function dumpDatabase(): Promise<{ json: string; tables: number }> {
  return prisma.$transaction(
    async (tx) => {
      const tables = await tx.$queryRaw<{ table_name: string }[]>`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name`;
      const parts: string[] = [];
      for (const { table_name } of tables) {
        const [{ rows }] = await tx.$queryRawUnsafe<{ rows: string }[]>(
          `SELECT coalesce(json_agg(t), '[]'::json)::text AS rows FROM ${quote(table_name)} t`
        );
        parts.push(`${JSON.stringify(table_name)}:${rows}`);
      }
      const header = `"format":"nugevonden-backup","version":1,"createdAt":${JSON.stringify(new Date().toISOString())}`;
      return { json: `{${header},"tables":{${parts.join(",")}}}`, tables: tables.length };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 120_000 }
  );
}

export async function createDatabaseBackup(
  now = new Date(),
  label?: string
): Promise<BackupObject & { durationMs: number }> {
  const started = Date.now();
  const { json } = await dumpDatabase();
  const body = gzipSync(Buffer.from(json, "utf8"));
  const key = backupKey(now, label);
  await backupStorage().client.send(
    new PutObjectCommand({ Bucket: backupStorage().bucket, Key: key, Body: body, ContentType: "application/gzip" })
  );
  return { key, size: body.length, createdAt: now, label, durationMs: Date.now() - started };
}

export async function listBackups(): Promise<BackupObject[]> {
  const { client, bucket } = backupStorage();
  const found: BackupObject[] = [];
  let token: string | undefined;
  do {
    const page = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: BACKUP_PREFIX, ContinuationToken: token })
    );
    for (const obj of page.Contents ?? []) {
      const createdAt = obj.Key ? backupTime(obj.Key) : null;
      if (obj.Key && createdAt) found.push({ key: obj.Key, size: obj.Size ?? 0, createdAt, label: backupLabel(obj.Key) });
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return found.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

const amsterdamDay = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "Europe/Amsterdam" });

// Which copies can go: everything from the last KEEP_ALL_HOURS stays, and
// of older ones only the first copy of each day (Amsterdam time) for
// KEEP_DAILY_DAYS days.
export function backupsToDelete(backups: BackupObject[], now = new Date()): BackupObject[] {
  const keepAllSince = now.getTime() - KEEP_ALL_HOURS * HOUR_MS;
  const keepDailySince = now.getTime() - KEEP_DAILY_DAYS * DAY_MS;
  const firstOfDay = new Map<string, BackupObject>();
  for (const b of backups) {
    const day = amsterdamDay(b.createdAt);
    const current = firstOfDay.get(day);
    if (!current || b.createdAt < current.createdAt) firstOfDay.set(day, b);
  }
  return backups.filter((b) => {
    const t = b.createdAt.getTime();
    if (t >= keepAllSince) return false;
    if (t >= keepDailySince && firstOfDay.get(amsterdamDay(b.createdAt)) === b) return false;
    return true;
  });
}

export async function pruneBackups(now = new Date()): Promise<number> {
  const doomed = backupsToDelete(await listBackups(), now);
  for (let i = 0; i < doomed.length; i += 1000) {
    await backupStorage().client.send(
      new DeleteObjectsCommand({
        Bucket: backupStorage().bucket,
        Delete: { Objects: doomed.slice(i, i + 1000).map((b) => ({ Key: b.key })) },
      })
    );
  }
  return doomed.length;
}

// Makes a copy, records how it went (Instellingen → Systeem) and tidies up
// old copies. Throws when the copy fails, after recording the error.
export async function backupNow(
  now = new Date(),
  label?: string
): Promise<BackupObject & { durationMs: number; pruned: number }> {
  try {
    const made = await createDatabaseBackup(now, label);
    const status = { backupLastRunAt: now, backupLastDurationMs: made.durationMs, backupLastError: null };
    await prisma.siteSettings.upsert({ where: { id: 1 }, create: { id: 1, ...status }, update: status });
    const pruned = await pruneBackups(now);
    console.log(
      `backup: ${made.key} (${(made.size / 1024).toFixed(0)} kB, ${made.durationMs} ms)` +
        (pruned ? `, ${pruned} oude kopie(ën) opgeruimd` : "")
    );
    return { ...made, pruned };
  } catch (err) {
    const message = (err instanceof Error ? err.message : String(err)).slice(0, 500);
    console.error("backup: mislukt", err);
    const status = { backupLastRunAt: now, backupLastError: message };
    await prisma.siteSettings.upsert({ where: { id: 1 }, create: { id: 1, ...status }, update: status }).catch(() => {});
    throw err;
  }
}

// The hourly job: make a copy, and mail the admins (at most once a day)
// when there has been no good copy for ALERT_AFTER_HOURS.
export async function runHourlyBackup(now = new Date()): Promise<void> {
  if (!storageConfigured()) {
    console.log("backup: geen bestandsopslag ingesteld, overgeslagen");
    return;
  }
  const settings = await prisma.siteSettings.findUnique({ where: { id: 1 }, select: { ownBackupsEnabled: true } });
  if (settings && !settings.ownBackupsEnabled) {
    // Railway makes the backups now; only let the old copies run out.
    await pruneBackups(now).catch((err) => console.error("backup: opruimen mislukt", err));
    return;
  }
  await backupNow(now).catch(() => {});
  await alertIfNoRecentBackup(now).catch((err) => console.error("backup: waarschuwing versturen mislukt", err));
}

async function alertIfNoRecentBackup(now: Date): Promise<void> {
  const [latest] = await listBackups().catch(() => [] as BackupObject[]);
  if (latest && now.getTime() - latest.createdAt.getTime() < ALERT_AFTER_HOURS * HOUR_MS) return;
  const settings = await prisma.siteSettings.findUnique({ where: { id: 1 } });
  if (settings?.backupAlertSentAt && now.getTime() - settings.backupAlertSentAt.getTime() < DAY_MS) return;

  const admins = await prisma.user.findMany({ where: { role: { name: "admin" } }, select: { email: true } });
  const since = latest
    ? latest.createdAt.toLocaleString("nl-NL", { timeZone: "Europe/Amsterdam" })
    : "nog nooit";
  const reason = settings?.backupLastError ? `Laatste foutmelding: ${settings.backupLastError}` : "";
  for (const { email } of admins) {
    await sendSystemAlertEmail(
      email,
      "Let op: geen recente back-up van de database",
      `De laatste geslaagde back-up is van ${since}. ${reason}`.trim()
    );
  }
  await prisma.siteSettings.update({ where: { id: 1 }, data: { backupAlertSentAt: now } });
}

// A download link for one copy, valid for an hour.
export async function backupDownloadUrl(key: string): Promise<string> {
  const { client, bucket } = backupStorage();
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 3600 });
}

// ---- Restoring (used by scripts/restore-backup.ts, never automatically) ----

export async function downloadBackup(key: string): Promise<Buffer> {
  const res = await backupStorage().client.send(new GetObjectCommand({ Bucket: backupStorage().bucket, Key: key }));
  const bytes = await res.Body?.transformToByteArray();
  if (!bytes) throw new Error(`Back-up ${key} is leeg.`);
  return Buffer.from(bytes);
}

type BackupFile = { format: string; version: number; createdAt: string; tables: Record<string, unknown[]> };

export function readBackup(gz: Buffer): BackupFile {
  const parsed = JSON.parse(gunzipSync(gz).toString("utf8")) as BackupFile;
  if (parsed.format !== "nugevonden-backup" || typeof parsed.tables !== "object") {
    throw new Error("Dit is geen back-up van Nugevonden.");
  }
  return parsed;
}

// Replaces the contents of every table in the backup with the backed-up
// rows, in one transaction: it either all works or nothing changes.
// Foreign-key checks are paused meanwhile (session_replication_role), so the
// order of the tables doesn't matter. Columns added since the backup keep
// their defaults.
export async function restoreBackup(backup: BackupFile): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL session_replication_role = replica`);
      const existing = new Set(
        (
          await tx.$queryRaw<{ table_name: string }[]>`
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
        ).map((t) => t.table_name)
      );
      const names = Object.keys(backup.tables).filter((n) => existing.has(n));
      if (names.length) await tx.$executeRawUnsafe(`TRUNCATE ${names.map(quote).join(", ")}`);
      for (const name of names) {
        const rows = backup.tables[name] as Record<string, unknown>[];
        counts[name] = rows.length;
        if (!rows.length) continue;
        const columns = (
          await tx.$queryRaw<{ column_name: string }[]>`
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = ${name}`
        ).map((c) => c.column_name);
        const inBackup = new Set(rows.flatMap((r) => Object.keys(r)));
        const cols = columns.filter((c) => inBackup.has(c)).map(quote).join(", ");
        await tx.$executeRawUnsafe(
          `INSERT INTO ${quote(name)} (${cols}) SELECT ${cols} FROM json_populate_recordset(NULL::${quote(name)}, $1::json)`,
          JSON.stringify(rows)
        );
      }
      // Counters (like the order number) continue after the restored rows.
      const serials = await tx.$queryRaw<{ table_name: string; column_name: string }[]>`
        SELECT table_name, column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND column_default LIKE 'nextval(%'`;
      for (const { table_name, column_name } of serials) {
        await tx.$executeRawUnsafe(
          `SELECT setval(pg_get_serial_sequence($1, $2), coalesce((SELECT max(${quote(column_name)}) FROM ${quote(table_name)}), 0) + 1, false)`,
          quote(table_name),
          column_name
        );
      }
    },
    { timeout: 300_000 }
  );
  return counts;
}

// Puts a copy back, the way both the admin button and the emergency route
// do it: first a copy of the current state (labelled, so it's the way back),
// then the restore, then note what was done. With requireSafetyCopy the
// restore doesn't start when that first copy fails.
export async function restoreFromKey(
  key: string,
  { requireSafetyCopy, now = new Date() }: { requireSafetyCopy: boolean; now?: Date }
): Promise<{ counts: Record<string, number>; safetyKey: string | null }> {
  if (!backupTime(key)) throw new Error("Onbekende back-up.");
  let safetyKey: string | null = null;
  try {
    safetyKey = (await backupNow(now, SAFETY_LABEL)).key;
  } catch (err) {
    if (requireSafetyCopy) throw new Error("Eerst een kopie van de huidige stand maken lukte niet; er is niets teruggezet.");
    console.error("restore: kopie van de huidige stand mislukt, toch doorgaan", err);
  }
  const counts = await restoreBackup(readBackup(await downloadBackup(key)));
  // The restored settings row is from the copy; bring the backup bookkeeping up to date.
  const status = { restoredFrom: key, restoredAt: new Date(), backupLastRunAt: now, backupLastError: null };
  await prisma.siteSettings.upsert({ where: { id: 1 }, create: { id: 1, ...status }, update: status });
  console.log(`restore: ${key} teruggezet` + (safetyKey ? ` (vorige stand bewaard als ${safetyKey})` : ""));
  return { counts, safetyKey };
}

// The emergency route, for when nobody can get into the site: set the
// RESTORE_BACKUP variable in Railway to "laatste" (the newest regular copy)
// or to a copy's name, and the next start restores it before the site opens.
// The value is remembered, so later restarts with the variable still set do
// nothing; remove the variable afterwards.
export async function emergencyRestoreOnStartup(): Promise<void> {
  const value = process.env.RESTORE_BACKUP?.trim();
  if (!value) return;
  try {
    if (!storageConfigured()) throw new Error("de bestandsopslag is niet ingesteld");
    const settings = await prisma.siteSettings.findUnique({ where: { id: 1 } }).catch(() => null);
    if (settings?.emergencyRestoreValue === value) {
      console.log(`restore: RESTORE_BACKUP=${value} is al uitgevoerd; haal de variabele weg in Railway.`);
      return;
    }
    const key =
      value === "laatste" || value === "latest"
        ? (await listBackups()).find((b) => b.label !== SAFETY_LABEL)?.key
        : value;
    if (!key) throw new Error("er is geen back-up gevonden");
    await restoreFromKey(key, { requireSafetyCopy: false });
    await prisma.siteSettings.update({ where: { id: 1 }, data: { emergencyRestoreValue: value } });
    console.log(`restore: noodroute klaar (${key}). Haal RESTORE_BACKUP weg in Railway.`);
  } catch (err) {
    console.error(`restore: noodroute RESTORE_BACKUP=${value} mislukt`, err);
  }
}
