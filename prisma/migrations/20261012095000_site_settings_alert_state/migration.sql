-- The warning mails about things that keep going wrong (src/lib/systemAlerts.ts).
ALTER TABLE "SiteSettings" ADD COLUMN "alertState" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "SiteSettings" ADD COLUMN "alertMailsEnabled" BOOLEAN NOT NULL DEFAULT true;
