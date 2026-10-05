-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "country" TEXT NOT NULL DEFAULT 'NL';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "referralSource" TEXT;

