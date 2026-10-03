-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "discountPercent" DECIMAL(5,2),
ADD COLUMN     "writingIncluded" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "CustomerPrice" (
    "id" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "companyId" TEXT NOT NULL,
    "websiteProductId" TEXT NOT NULL,

    CONSTRAINT "CustomerPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerPrice_companyId_websiteProductId_key" ON "CustomerPrice"("companyId", "websiteProductId");

-- AddForeignKey
ALTER TABLE "CustomerPrice" ADD CONSTRAINT "CustomerPrice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPrice" ADD CONSTRAINT "CustomerPrice_websiteProductId_fkey" FOREIGN KEY ("websiteProductId") REFERENCES "WebsiteProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

