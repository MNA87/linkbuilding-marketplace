-- AlterTable
ALTER TABLE "WebsiteMetric" ADD COLUMN     "behindCloudflare" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "citationFlow" INTEGER,
ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "spamScore" INTEGER,
ADD COLUMN     "trustFlow" INTEGER;
