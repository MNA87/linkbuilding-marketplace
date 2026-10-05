-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "vatCheckAddress" TEXT,
ADD COLUMN     "vatCheckName" TEXT,
ADD COLUMN     "vatCheckRef" TEXT,
ADD COLUMN     "vatCheckedAt" TIMESTAMP(3),
ADD COLUMN     "vatStatus" TEXT NOT NULL DEFAULT 'none';

-- AlterTable
ALTER TABLE "LaunchItem" ADD COLUMN     "note" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "vatNote" TEXT;


-- Planning, Livegang step 1: check the VAT for customers abroad with the accountant.
INSERT INTO "LaunchItem" ("id", "list", "step", "title", "note", "status", "position")
SELECT gen_random_uuid()::text, 'livegang', 1, 'Btw buitenlandse klanten laten checken door boekhouder',
'Het platform rekent nu zo:
• Nederlandse klant: 21% btw.
• Bedrijf in een ander EU-land met een btw-nummer dat volgens VIES geldig is: direct 0%, "BTW verlegd" op de factuur, met hun en jouw btw-nummer. Jij hoeft niets goed te keuren; noemt VIES een andere bedrijfsnaam, dan krijg je achteraf een seintje.
• Bedrijf in een ander EU-land zonder (gecontroleerd) btw-nummer: 21%.
• Bedrijf buiten de EU (VK, Zwitserland, Noorwegen, VS): 0%, "Btw niet van toepassing".
• "Ander land" of particulier: 21%.

Vraag je boekhouder:
1. Klopt het dat linkbuilding/artikelplaatsing een dienst is die belast is waar de zakelijke klant gevestigd is (hoofdregel, art. 44), ook al staan de websites in Nederland?
2. Is een VIES-controle met raadplegingsnummer genoeg bewijs dat de klant een ondernemer is? Wat als VIES geen bedrijfsnaam geeft (bijv. Duitsland)?
3. Mag ik bedrijven buiten de EU zonder btw factureren, en welk bewijs moet ik dan bewaren?
4. In welke rubriek van de btw-aangifte komen de EU-diensten (3b?) en hoe vaak doe ik de opgaaf ICP? (Admin → Facturen → ICP-overzicht geeft de bedragen per kwartaal.)
5. Klopt de tekst op de factuur: "BTW verlegd (art. 196 Btw-richtlijn)" en "Btw niet van toepassing — dienst aan een ondernemer buiten de EU"?
6. Is het goed dat een geldig btw-nummer volgens VIES genoeg is, ook als VIES een andere bedrijfsnaam noemt (dan krijg ik een seintje)?
7. Wat als een klant achteraf een verkeerd btw-nummer bleek te gebruiken?',
'todo',
COALESCE((SELECT MAX("position") FROM "LaunchItem" WHERE "list" = 'livegang' AND "step" = 1), -1) + 1
WHERE NOT EXISTS (SELECT 1 FROM "LaunchItem" WHERE "list" = 'livegang' AND "title" = 'Btw buitenlandse klanten laten checken door boekhouder');
