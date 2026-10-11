-- Other addresses a customer mails orders from (Binnengekomen → Bestaande klant).
ALTER TABLE "User" ADD COLUMN "mailAliases" TEXT[] DEFAULT ARRAY[]::TEXT[];
