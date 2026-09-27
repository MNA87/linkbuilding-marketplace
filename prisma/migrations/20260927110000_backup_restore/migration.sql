-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN "ownBackupsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "restoredFrom" TEXT,
ADD COLUMN "restoredAt" TIMESTAMP(3),
ADD COLUMN "emergencyRestoreValue" TEXT;
