-- AlterTable
ALTER TABLE "Placement" ADD COLUMN     "liveMailSentAt" TIMESTAMP(3);

-- Everything already live was mailed about (or never will be): no old mails.
UPDATE "Placement" SET "liveMailSentAt" = COALESCE("publishedAt", CURRENT_TIMESTAMP) WHERE "liveUrl" IS NOT NULL;
