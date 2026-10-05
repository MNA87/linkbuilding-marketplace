-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "periodic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "topicId" TEXT,
ADD COLUMN     "topicNameSnap" TEXT;

-- AlterTable
ALTER TABLE "Website" ADD COLUMN     "exampleUrl" TEXT,
ADD COLUMN     "maxLinks" INTEGER,
ADD COLUMN     "sponsored" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "WebsiteProduct" ADD COLUMN     "periodic" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Topic" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteProductTopicPrice" (
    "id" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "websiteProductId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,

    CONSTRAINT "WebsiteProductTopicPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_WebsiteNiches" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Topic_name_key" ON "Topic"("name");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteProductTopicPrice_websiteProductId_topicId_key" ON "WebsiteProductTopicPrice"("websiteProductId", "topicId");

-- CreateIndex
CREATE UNIQUE INDEX "_WebsiteNiches_AB_unique" ON "_WebsiteNiches"("A", "B");

-- CreateIndex
CREATE INDEX "_WebsiteNiches_B_index" ON "_WebsiteNiches"("B");

-- AddForeignKey
ALTER TABLE "WebsiteProductTopicPrice" ADD CONSTRAINT "WebsiteProductTopicPrice_websiteProductId_fkey" FOREIGN KEY ("websiteProductId") REFERENCES "WebsiteProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteProductTopicPrice" ADD CONSTRAINT "WebsiteProductTopicPrice_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_WebsiteNiches" ADD CONSTRAINT "_WebsiteNiches_A_fkey" FOREIGN KEY ("A") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_WebsiteNiches" ADD CONSTRAINT "_WebsiteNiches_B_fkey" FOREIGN KEY ("B") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Homepage links were the kind bought per year; blog articles for good.
UPDATE "WebsiteProduct" SET "periodic" = true
WHERE "productId" IN (SELECT "id" FROM "Product" WHERE "type" = 'HOMEPAGE_LINK');
UPDATE "OrderItem" SET "periodic" = true
WHERE "websiteProductId" IN (SELECT "id" FROM "WebsiteProduct" WHERE "periodic" = true);

-- The usual topics besides Algemeen; editable under Instellingen → Stamdata.
INSERT INTO "Topic" ("id", "name", "sortOrder") VALUES
  ('topic_' || md5('Casino'), 'Casino', 1),
  ('topic_' || md5('Lening'), 'Lening', 2),
  ('topic_' || md5('Crypto'), 'Crypto', 3),
  ('topic_' || md5('Dating'), 'Dating', 4),
  ('topic_' || md5('CBD'), 'CBD', 5)
ON CONFLICT ("name") DO NOTHING;
