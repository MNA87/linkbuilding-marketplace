-- De standaardprijs per orderregel op het moment van bestellen, om korting
-- (standaard - klantprijs) te tonen bij Bevestigen en op de factuur. Nullable:
-- bestaande regels hebben geen lijstprijs en tonen dan geen kortingsregel.
ALTER TABLE "OrderItem" ADD COLUMN "listPriceSnap" DECIMAL(10,2);
