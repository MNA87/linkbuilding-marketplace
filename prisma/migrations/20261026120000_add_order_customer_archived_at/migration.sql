-- Klant kan een order archiveren in Mijn orders (los van de admin-archivering).
ALTER TABLE "Order" ADD COLUMN "customerArchivedAt" TIMESTAMP(3);
