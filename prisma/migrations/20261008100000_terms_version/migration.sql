-- Which version of the voorwaarden applied when an account was made and
-- when an order was paid (no checkbox: registering or paying means agreeing).
ALTER TABLE "User" ADD COLUMN "termsVersion" TEXT, ADD COLUMN "termsAcceptedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "termsVersion" TEXT, ADD COLUMN "termsAcceptedAt" TIMESTAMP(3);

-- The Livegang item: decided without a checkbox.
UPDATE "LaunchItem"
SET "note" = 'Geen vinkje (conversie). Bij registreren blijft het vinkje. Bij betalen geen vinkje: op de betaalpagina van Stripe staat bij Betalen dat betalen betekent dat je akkoord gaat, met een link naar de voorwaarden. Het platform legt bij registratie en bij elke bestelling de datum en de versie vast (src/lib/terms.ts: TERMS_VERSION ophogen als de voorwaarden veranderen). Tekst van de voorwaarden laten nakijken.'
WHERE "list" = 'livegang' AND "title" = 'Akkoord voorwaarden vastleggen';
