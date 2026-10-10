-- When the last link to (re)set the password was mailed: "Wachtwoord
-- vergeten" sends at most one per 10 minutes to an address.
ALTER TABLE "User" ADD COLUMN "passwordResetSentAt" TIMESTAMP(3);
