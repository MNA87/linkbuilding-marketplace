-- AlterTable
ALTER TABLE "InboundMail" ADD COLUMN     "docError" TEXT,
ADD COLUMN     "docUrl" TEXT,
ADD COLUMN     "endClient" TEXT,
ADD COLUMN     "externalRef" TEXT,
ADD COLUMN     "quotedPrice" DECIMAL(10,2),
ADD COLUMN     "requestLabel" TEXT;

