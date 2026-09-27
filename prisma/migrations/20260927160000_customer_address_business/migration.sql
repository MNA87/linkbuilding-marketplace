-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "isBusiness" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "address" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "postcode" TEXT;
