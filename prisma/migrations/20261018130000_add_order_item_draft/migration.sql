-- A half-filled bulk "Blog links" row, saved as you go so an unfinished order
-- can be resumed later on any device. Cleared when the order is placed.
ALTER TABLE "OrderItem" ADD COLUMN "draftContent" JSONB;
