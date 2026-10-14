-- Customer can deliver the article as a Google Doc link instead of typing it.
ALTER TABLE "OrderItem" ADD COLUMN "articleDocUrl" TEXT;
