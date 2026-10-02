-- AlterTable
ALTER TABLE "InboundMail" ADD COLUMN     "inReplyTo" TEXT,
ADD COLUMN     "isReply" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "orderItemId" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "onAccount" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "previewSentAt" TIMESTAMP(3),
ADD COLUMN     "previewVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "OutboundMail" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboundMail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OutboundMail_messageId_key" ON "OutboundMail"("messageId");

-- CreateIndex
CREATE INDEX "OutboundMail_orderItemId_idx" ON "OutboundMail"("orderItemId");

-- AddForeignKey
ALTER TABLE "InboundMail" ADD CONSTRAINT "InboundMail_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundMail" ADD CONSTRAINT "OutboundMail_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

