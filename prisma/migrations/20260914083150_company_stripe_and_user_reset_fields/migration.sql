-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "stripeAccountId" TEXT,
ADD COLUMN     "stripeAccountOnboarded" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "passwordResetTokenExpires" TIMESTAMP(3),
ADD COLUMN     "passwordResetTokenHash" TEXT;
