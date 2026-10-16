-- Agency "bulk-besteller" flag per customer company.
ALTER TABLE "Company" ADD COLUMN "bulkOrdering" BOOLEAN NOT NULL DEFAULT false;
