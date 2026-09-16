-- CreateTable
CREATE TABLE "SiteSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "noindexEnabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SiteSettings_pkey" PRIMARY KEY ("id")
);

-- Seed the singleton row (starts noindexed, matching the hardcoded default
-- this replaces).
INSERT INTO "SiteSettings" ("id", "noindexEnabled") VALUES (1, true);
