// Hersteltest: puts the newest backup into an EMPTY database and checks
// every table came back complete — proof that a backup can really be put
// back. Run in a temporary Railway service with its own temporary Postgres
// (DATABASE_URL pointing there, BACKUP_STORAGE_* referencing the web
// service's), after `prisma migrate deploy` made the tables:
//
//   npx prisma migrate deploy && npx tsx --tsconfig tsconfig.json scripts/restore-test.ts
//
// It refuses any database with customers or orders in it, so it can never
// overwrite the live one.
import { downloadBackup, listBackups, readBackup, restoreBackup, SAFETY_LABEL } from "../src/lib/databaseBackup";
import { prisma } from "../src/lib/prisma";

const quote = (name: string) => `"${name.replace(/"/g, '""')}"`;

async function count(table: string): Promise<number> {
  const [row] = await prisma.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM ${quote(table)}`);
  return Number(row?.n ?? 0);
}

async function main() {
  const [users, orders] = await Promise.all([prisma.user.count(), prisma.order.count()]);
  if (users > 0 || orders > 0) {
    throw new Error(
      `GESTOPT: deze database is niet leeg (${users} gebruikers, ${orders} orders). Alleen in een lege database.`
    );
  }

  const latest = (await listBackups()).find((b) => b.label !== SAFETY_LABEL);
  if (!latest) throw new Error("Geen back-up gevonden.");
  const backup = readBackup(await downloadBackup(latest.key));
  console.log(
    `hersteltest: back-up ${latest.key} (${(latest.size / 1024).toFixed(0)} kB), gemaakt ${backup.createdAt}`
  );

  const started = Date.now();
  const restored = await restoreBackup(backup);
  console.log(`hersteltest: teruggezet in ${((Date.now() - started) / 1000).toFixed(1)} s`);

  let wrong = 0;
  let rows = 0;
  for (const [table, expected] of Object.entries(restored).sort()) {
    const actual = await count(table);
    rows += actual;
    if (actual !== expected) wrong++;
    console.log(`hersteltest: ${actual === expected ? "OK " : "FOUT"} ${table}: ${actual} van ${expected}`);
  }
  const skipped = Object.keys(backup.tables).filter((t) => !(t in restored));
  if (skipped.length) console.log(`hersteltest: niet in deze database: ${skipped.join(", ")}`);
  console.log(
    wrong === 0
      ? `hersteltest: GESLAAGD — ${Object.keys(restored).length} tabellen, ${rows} rijen, alles compleet.`
      : `hersteltest: MISLUKT — ${wrong} tabel(len) niet compleet.`
  );
  if (wrong) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error("hersteltest:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
