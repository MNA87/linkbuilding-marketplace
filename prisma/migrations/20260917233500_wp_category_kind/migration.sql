ALTER TABLE "WpCategory" ADD COLUMN "kind" "ProductType" NOT NULL DEFAULT 'BLOG_POST';

DROP INDEX "WpCategory_websiteId_wpTermId_key";

CREATE UNIQUE INDEX "WpCategory_websiteId_wpTermId_kind_key" ON "WpCategory"("websiteId", "wpTermId", "kind");
