CREATE TABLE "WpCategory" (
    "id" TEXT NOT NULL,
    "wpTermId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,

    CONSTRAINT "WpCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WpCategory_websiteId_wpTermId_key" ON "WpCategory"("websiteId", "wpTermId");

ALTER TABLE "WpCategory" ADD CONSTRAINT "WpCategory_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrderItem" ADD COLUMN "wpTermId" INTEGER;
ALTER TABLE "OrderItem" ADD COLUMN "wpCategoryNameSnap" TEXT;
