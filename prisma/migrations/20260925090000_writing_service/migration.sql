-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "writingPrice" DECIMAL(10,2) NOT NULL DEFAULT 25;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "briefLinks" JSONB,
ADD COLUMN     "writeForMe" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "writingFeeSnap" DECIMAL(10,2) NOT NULL DEFAULT 0;

