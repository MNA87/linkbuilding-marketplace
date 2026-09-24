-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN "payButtonColor" TEXT NOT NULL DEFAULT '#0d9488',
ADD COLUMN "primaryButtonColor" TEXT NOT NULL DEFAULT '#2563eb',
ADD COLUMN "primaryButtonFilled" BOOLEAN NOT NULL DEFAULT true;
