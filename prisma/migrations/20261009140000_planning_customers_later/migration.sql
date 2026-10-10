-- Planning (9-10-2026): what's left after inviting mail customers online,
-- for when it's needed.
INSERT INTO "LaunchItem" ("id", "list", "step", "title", "status", "position", "note")
SELECT gen_random_uuid()::text, 'nice', 0, 'Collega uitnodigen', 'todo',
  (SELECT coalesce(max("position"), 0) + 1 FROM "LaunchItem" WHERE "list" = 'nice'),
  E'Een klant (of jij, op de klantpagina) nodigt een collega uit voor hetzelfde bedrijf: dezelfde prijzen, bestellingen en facturen.\nNodig zodra de eerste klanten online bestellen en een collega willen toevoegen.\nNiet automatisch op maildomein koppelen: dan kan iedereen met hetzelfde domein meekijken.'
WHERE NOT EXISTS (SELECT 1 FROM "LaunchItem" WHERE "title" = 'Collega uitnodigen');

INSERT INTO "LaunchItem" ("id", "list", "step", "title", "status", "position", "note")
SELECT gen_random_uuid()::text, 'nice', 0, 'Vaste klanten online op rekening laten bestellen', 'todo',
  (SELECT coalesce(max("position"), 0) + 1 FROM "LaunchItem" WHERE "list" = 'nice'),
  E'Klanten die per mail op rekening bestellen, betalen online nu direct (iDEAL/kaart). Per klant een vinkje "op rekening": hun online bestellingen gaan dan ook op de verzamelfactuur.\nEerst navragen of vaste klanten dat echt willen.'
WHERE NOT EXISTS (SELECT 1 FROM "LaunchItem" WHERE "title" = 'Vaste klanten online op rekening laten bestellen');

INSERT INTO "LaunchItem" ("id", "list", "step", "title", "status", "position", "note")
SELECT gen_random_uuid()::text, 'nice', 0, 'Facturen van online bestellingen ook mailen', 'todo',
  (SELECT coalesce(max("position"), 0) + 1 FROM "LaunchItem" WHERE "list" = 'nice'),
  E'Na een online betaling de factuur (PDF) mailen naar "Facturen naar" of het adres van de klant. Nu downloadt de klant hem zelf bij Facturen.\nPas nodig als een boekhouding erom vraagt.'
WHERE NOT EXISTS (SELECT 1 FROM "LaunchItem" WHERE "title" = 'Facturen van online bestellingen ook mailen');
