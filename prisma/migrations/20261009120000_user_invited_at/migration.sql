-- When the admin last invited a customer (made from a mail order) to
-- choose a password and order online.
ALTER TABLE "User" ADD COLUMN "invitedAt" TIMESTAMP(3);
