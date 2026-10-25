-- Marks that a featured image's stored file was purged from our bucket after
-- it went live on the target site (the key stays for the plugin's change
-- check; only the bytes are gone).
ALTER TABLE "OrderItem" ADD COLUMN "articleImagePurged" BOOLEAN NOT NULL DEFAULT false;
