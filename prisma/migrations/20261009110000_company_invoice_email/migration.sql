-- Where the verzamelfactuur goes, when that's another address than the
-- one the orders come from; empty = the customer's own email.
ALTER TABLE "Company" ADD COLUMN "invoiceEmail" TEXT;
