// Puts a database backup back (see src/lib/databaseBackup.ts). This REPLACES
// everything in the database with the backup, so it is never run by the
// app itself — only by hand, after deciding a restore is needed:
//
//   npx tsx --tsconfig tsconfig.json scripts/restore-backup.ts            list the copies
//   npx tsx --tsconfig tsconfig.json scripts/restore-backup.ts <key> --yes  restore one
//   npx tsx --tsconfig tsconfig.json scripts/restore-backup.ts ./file.json.gz --yes
//
// Needs DATABASE_URL and the STORAGE_* variables of the environment to restore.
import { readFile } from "node:fs/promises";
import { downloadBackup, listBackups, readBackup, restoreBackup } from "../src/lib/databaseBackup";
import { prisma } from "../src/lib/prisma";

async function main() {
  const [source, flag] = process.argv.slice(2);
  if (!source) {
    for (const b of (await listBackups()).slice(0, 60)) {
      console.log(`${b.key}  ${(b.size / 1024).toFixed(0)} kB  ${b.createdAt.toLocaleString("nl-NL", { timeZone: "Europe/Amsterdam" })}`);
    }
    return;
  }
  const gz = source.endsWith(".json.gz") && !source.startsWith("database-backups/")
    ? await readFile(source)
    : await downloadBackup(source);
  const backup = readBackup(gz);
  const tables = Object.keys(backup.tables).length;
  console.log(`Back-up van ${backup.createdAt} met ${tables} tabellen.`);
  if (flag !== "--yes") {
    console.log("Niets gedaan. Voeg --yes toe om de database hiermee te VERVANGEN.");
    return;
  }
  const counts = await restoreBackup(backup);
  console.log("Teruggezet:", counts);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
