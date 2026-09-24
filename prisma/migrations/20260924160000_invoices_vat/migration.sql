-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('INVOICE', 'CREDIT');

-- DropIndex
DROP INDEX "Invoice_orderId_key";

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "billingAddress" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "billingCity" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "billingPostcode" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "vatNumber" TEXT;

-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "sellerAddress" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "sellerCity" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "sellerEmail" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "sellerIban" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "sellerKvk" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "sellerName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "sellerPostcode" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "sellerVatNumber" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "creditsInvoiceId" TEXT,
ADD COLUMN     "customerDetails" JSONB,
ADD COLUMN     "sellerDetails" JSONB,
ADD COLUMN     "subtotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "type" "InvoiceType" NOT NULL DEFAULT 'INVOICE',
ADD COLUMN     "vatAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "InvoiceCounter" (
    "year" INTEGER NOT NULL,
    "last" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InvoiceCounter_pkey" PRIMARY KEY ("year")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_orderId_type_key" ON "Invoice"("orderId", "type");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_creditsInvoiceId_fkey" FOREIGN KEY ("creditsInvoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Invoices issued before VAT was charged: the whole amount was the price,
-- with no VAT on top.
UPDATE "Invoice" SET "subtotal" = "amount";
