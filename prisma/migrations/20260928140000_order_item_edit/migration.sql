-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "articleSlug" TEXT,
ADD COLUMN     "updatePending" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Website" ADD COLUMN     "articleUrlBase" TEXT;

-- The two sites whose articles live under a fixed part of the URL.
UPDATE "Website" SET "articleUrlBase" = 'https://nugevonden.nl/internet/' WHERE "domain" = 'nugevonden.nl';
UPDATE "Website" SET "articleUrlBase" = 'https://enqueteplein.nl/algemeen/' WHERE "domain" = 'enqueteplein.nl';
