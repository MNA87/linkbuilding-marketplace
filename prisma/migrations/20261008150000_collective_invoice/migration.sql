-- Verzamelfactuur: one invoice per customer per month for the orders on
-- account (ordered by mail), checked and sent by the admin.
ALTER TABLE "Invoice" ALTER COLUMN "orderId" DROP NOT NULL;
ALTER TABLE "Invoice" ADD COLUMN "period" TEXT,
  ADD COLUMN "dueAt" TIMESTAMP(3),
  ADD COLUMN "paidAt" TIMESTAMP(3),
  ADD COLUMN "reminderSentAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "collectiveInvoiceId" TEXT;
ALTER TABLE "Order" ADD CONSTRAINT "Order_collectiveInvoiceId_fkey" FOREIGN KEY ("collectiveInvoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
