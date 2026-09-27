import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/email", () => ({ sendSystemAlertEmail: vi.fn() }));

import { backupKey, backupLabel, backupTime, backupsToDelete, type BackupObject } from "./databaseBackup";

const at = (iso: string): BackupObject => ({ key: backupKey(new Date(iso)), size: 1, createdAt: new Date(iso) });

describe("backupKey / backupTime", () => {
  it("puts the time in the name and reads it back", () => {
    const key = backupKey(new Date("2026-09-27T08:05:12.345Z"));
    expect(key).toBe("database-backups/2026-09-27T08-05-12Z.json.gz");
    expect(backupTime(key)?.toISOString()).toBe("2026-09-27T08:05:12.000Z");
    expect(backupTime("database-backups/iets-anders.txt")).toBeNull();
    expect(backupTime("order-uploads/2026-09-27T08-05-12Z.json.gz")).toBeNull();
  });

  it("can carry a label, e.g. for the copy made before a restore", () => {
    const key = backupKey(new Date("2026-09-27T08:05:12Z"), "voorterugzetten");
    expect(key).toBe("database-backups/2026-09-27T08-05-12Z-voorterugzetten.json.gz");
    expect(backupTime(key)?.toISOString()).toBe("2026-09-27T08:05:12.000Z");
    expect(backupLabel(key)).toBe("voorterugzetten");
    expect(backupLabel(backupKey(new Date()))).toBeUndefined();
  });
});

describe("backupsToDelete", () => {
  const now = new Date("2026-09-27T12:00:00Z");

  it("keeps every copy of the last 48 hours", () => {
    const recent = [at("2026-09-27T11:00:00Z"), at("2026-09-26T13:00:00Z"), at("2026-09-25T12:30:00Z")];
    expect(backupsToDelete(recent, now)).toEqual([]);
  });

  it("keeps only the first copy of each older day", () => {
    const first = at("2026-09-20T00:30:00Z"); // 02:30 in Amsterdam
    const later = at("2026-09-20T10:00:00Z");
    expect(backupsToDelete([later, first], now)).toEqual([later]);
  });

  it("drops copies older than 14 days", () => {
    const old = at("2026-09-10T06:00:00Z");
    expect(backupsToDelete([old], now)).toEqual([old]);
  });

  it("groups days by Amsterdam time", () => {
    // 22:30 UTC on the 19th is already the 20th in Amsterdam.
    const lateEvening = at("2026-09-19T22:30:00Z");
    const morning = at("2026-09-20T06:00:00Z");
    expect(backupsToDelete([morning, lateEvening], now)).toEqual([morning]);
  });
});
