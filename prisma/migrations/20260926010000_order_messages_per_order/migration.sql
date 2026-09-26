-- Messages move from one link (OrderItem) to the whole order; existing
-- messages keep their conversation under the order their link belongs to.
ALTER TABLE "OrderMessage" ADD COLUMN "orderId" TEXT;

UPDATE "OrderMessage" m SET "orderId" = i."orderId" FROM "OrderItem" i WHERE i."id" = m."orderItemId";

ALTER TABLE "OrderMessage" ALTER COLUMN "orderId" SET NOT NULL;

-- DropForeignKey
ALTER TABLE "OrderMessage" DROP CONSTRAINT "OrderMessage_orderItemId_fkey";

-- DropIndex
DROP INDEX "OrderMessage_orderItemId_createdAt_idx";

ALTER TABLE "OrderMessage" DROP COLUMN "orderItemId";

-- CreateIndex
CREATE INDEX "OrderMessage_orderId_createdAt_idx" ON "OrderMessage"("orderId", "createdAt");

-- AddForeignKey
ALTER TABLE "OrderMessage" ADD CONSTRAINT "OrderMessage_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
