-- A bulk "Blog links" order is one cart order whose items may each belong to a
-- different project (the agency's client). The order keeps one projectId for
-- grouping/billing; this per-item projectId is the client label per row.
ALTER TABLE "OrderItem" ADD COLUMN "projectId" TEXT;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
