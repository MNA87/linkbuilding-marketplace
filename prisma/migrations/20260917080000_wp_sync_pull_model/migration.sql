ALTER TABLE "Website" RENAME COLUMN "publishBridgeSecret" TO "wpSyncSecret";
CREATE UNIQUE INDEX "Website_wpSyncSecret_key" ON "Website"("wpSyncSecret");
ALTER TABLE "OrderItem" ADD COLUMN "readyToPublish" BOOLEAN NOT NULL DEFAULT false;
