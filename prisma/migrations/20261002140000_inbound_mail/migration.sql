-- CreateTable
CREATE TABLE "InboundMail" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "fromName" TEXT,
    "subject" TEXT NOT NULL,
    "text" TEXT NOT NULL DEFAULT '',
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'new',
    "customerId" TEXT,
    "websiteId" TEXT,
    "articleTitle" TEXT,
    "articleBody" TEXT,
    "links" JSONB NOT NULL DEFAULT '[]',
    "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "InboundMail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InboundMail_messageId_key" ON "InboundMail"("messageId");

-- CreateIndex
CREATE INDEX "InboundMail_status_receivedAt_idx" ON "InboundMail"("status", "receivedAt");

-- AddForeignKey
ALTER TABLE "InboundMail" ADD CONSTRAINT "InboundMail_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundMail" ADD CONSTRAINT "InboundMail_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE SET NULL ON UPDATE CASCADE;

