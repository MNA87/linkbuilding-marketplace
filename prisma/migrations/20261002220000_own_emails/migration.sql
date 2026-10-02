-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "ownEmails" TEXT[] DEFAULT ARRAY[]::TEXT[];


-- Your own addresses, so a mail from them reads as a forward (Binnengekomen).
INSERT INTO "SiteSettings" ("id", "ownEmails")
VALUES (1, ARRAY['info@mnamediainvest.nl', 'info@nugevonden.nl', 'info@kvinl.nl', 'modernnl@gmail.com'])
ON CONFLICT ("id") DO UPDATE SET "ownEmails" = EXCLUDED."ownEmails"
WHERE cardinality("SiteSettings"."ownEmails") = 0;

-- Nice to have: a mail to you when an order comes in by mail.
INSERT INTO "LaunchItem" ("id", "list", "step", "title", "status", "position")
SELECT gen_random_uuid()::text, 'nice', 0, 'Mail aan mij bij nieuwe bestelling per mail', 'todo',
       COALESCE((SELECT MAX("position") FROM "LaunchItem" WHERE "list" = 'nice'), -1) + 1
WHERE NOT EXISTS (SELECT 1 FROM "LaunchItem" WHERE "list" = 'nice' AND "title" = 'Mail aan mij bij nieuwe bestelling per mail');
