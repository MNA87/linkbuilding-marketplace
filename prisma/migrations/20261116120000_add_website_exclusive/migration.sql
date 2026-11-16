-- Sites die alleen via Publito te boeken zijn ("Exclusief" in de marktplaats).
ALTER TABLE "Website" ADD COLUMN "exclusive" BOOLEAN NOT NULL DEFAULT false;
