CREATE SEQUENCE "Order_orderNumber_seq";
ALTER TABLE "Order" ADD COLUMN "orderNumber" INTEGER NOT NULL DEFAULT nextval('"Order_orderNumber_seq"');
ALTER SEQUENCE "Order_orderNumber_seq" OWNED BY "Order"."orderNumber";
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");
