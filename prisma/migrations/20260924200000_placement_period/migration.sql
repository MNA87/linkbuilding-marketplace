-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "durationYears" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "publishAt" TIMESTAMP(3),
ADD COLUMN     "renewsOrderItemId" TEXT;

-- AlterTable
ALTER TABLE "Placement" ADD COLUMN     "expiredAt" TIMESTAMP(3),
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "reminderSentAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_renewsOrderItemId_fkey" FOREIGN KEY ("renewsOrderItemId") REFERENCES "OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

