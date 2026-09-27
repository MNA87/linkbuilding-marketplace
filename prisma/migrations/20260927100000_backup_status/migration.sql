-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN "backupLastRunAt" TIMESTAMP(3),
ADD COLUMN "backupLastDurationMs" INTEGER,
ADD COLUMN "backupLastError" TEXT,
ADD COLUMN "backupAlertSentAt" TIMESTAMP(3);
