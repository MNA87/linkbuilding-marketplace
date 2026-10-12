-- WordPress plugin versions: new ones go to test sites first, the rest
-- get the released one (src/lib/pluginReleases.ts).
ALTER TABLE "Website" ADD COLUMN "pluginTestSite" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "wpPluginVersion" TEXT,
ADD COLUMN "wpPluginSeenAt" TIMESTAMP(3);
ALTER TABLE "SiteSettings" ADD COLUMN "pluginReleasedVersion" TEXT;

-- 1.15.0 was tested on a2f.nl on 12-10-2026; a2f.nl is the test site.
UPDATE "SiteSettings" SET "pluginReleasedVersion" = '1.15.0' WHERE "pluginReleasedVersion" IS NULL;
UPDATE "Website" SET "pluginTestSite" = true WHERE "domain" IN ('a2f.nl', 'www.a2f.nl');
