-- Planning tidied up (7-10-2026): doubles merged into the item with the
-- fuller note, finished items ticked off, and the verzamelfactuur added.

-- Doubles: the one without a note goes.
DELETE FROM "LaunchItem" WHERE "list" = 'nice' AND "title" = 'Favorieten'
  AND EXISTS (SELECT 1 FROM "LaunchItem" WHERE "list" = 'nice' AND "title" = 'Favorieten voor klanten');
DELETE FROM "LaunchItem" WHERE "list" = 'nice' AND "title" = 'Controle of de link nog live staat'
  AND EXISTS (SELECT 1 FROM "LaunchItem" WHERE "list" = 'nice' AND "title" = 'Links na plaatsing automatisch controleren');
DELETE FROM "LaunchItem" WHERE "list" = 'nice' AND "title" = 'Regels van de uitgever per site'
  AND EXISTS (SELECT 1 FROM "LaunchItem" WHERE "list" = 'nice' AND "title" = 'Plaatsingsregels per site');
-- Nieuw (and Snel online) are part of Kenmerken now.
DELETE FROM "LaunchItem" WHERE "list" = 'nice' AND "title" = 'Labels Nieuw en Populair terug'
  AND EXISTS (SELECT 1 FROM "LaunchItem" WHERE "list" = 'nice' AND "title" LIKE 'Kenmerken in de Marketplace%');
UPDATE "LaunchItem" SET "title" = 'Filter op verkeer'
WHERE "list" = 'nice' AND "title" = 'Filter op verkeer en label Snel online';
-- The vinkje at checkout is the Livegang item.
DELETE FROM "LaunchItem" WHERE "list" = 'nice' AND "title" = 'Toestemmingsvinkjes bij bestellen'
  AND EXISTS (SELECT 1 FROM "LaunchItem" WHERE "list" = 'livegang' AND "title" = 'Akkoord voorwaarden vastleggen');
UPDATE "LaunchItem"
SET "note" = 'Verplicht vinkje bij afrekenen: akkoord met de voorwaarden en het privacybeleid. Vastleggen wie, wanneer en met welke versie.'
WHERE "list" = 'livegang' AND "title" = 'Akkoord voorwaarden vastleggen' AND coalesce("note", '') = '';

-- Already built.
UPDATE "LaunchItem" SET "status" = 'done'
WHERE "list" = 'nice' AND "status" <> 'done'
  AND "title" IN ('Prijs per onderwerp (casino, crypto, lening)', 'Tweestapsverificatie voor klanten', 'Sessiebeveiliging');

-- New.
INSERT INTO "LaunchItem" ("id", "list", "step", "title", "status", "position", "note")
SELECT gen_random_uuid()::text, 'livegang', 0, 'Verzamelfactuur', 'todo',
  (SELECT coalesce(max("position"), 0) + 1 FROM "LaunchItem" WHERE "list" = 'livegang'),
  'Eén factuur per maand voor klanten die op rekening bestellen (bijv. via de mail), met alle orders van die maand.'
WHERE NOT EXISTS (SELECT 1 FROM "LaunchItem" WHERE "title" = 'Verzamelfactuur');

INSERT INTO "LaunchItem" ("id", "list", "step", "title", "status", "position", "note")
SELECT gen_random_uuid()::text, 'nice', 0, 'Nieuw WordPress-thema voor nugevonden.nl', 'todo',
  (SELECT coalesce(max("position"), 0) + 1 FROM "LaunchItem" WHERE "list" = 'nice'),
  E'Een eigen, licht thema (zonder paginabouwer) in de stijl van het platform: koppen met schreefletter, lichte achtergrond, witte kaarten, groene knoppen. Gericht op registreren.\n\nOpbouw (ontwerp versie 6, 8-10-2026):\n- Lichte balk bovenaan (zoals bij Backlinks.nl): links de USP''s met vinkjes (Linkgarantie, Vooraf de URL van je artikel, Elke link gecontroleerd), rechts Inloggen met een poppetje-icoon.\n- Daaronder het menu: logo links, rechts de menu-items en de groene knop Gratis registreren (de enige Registreren-knop bovenin).\n- Balk en menu schuiven samen mee naar beneden bij scrollen, met een lichte schaduw.\n- Op mobiel: in de bovenbalk één USP en Inloggen, in het menu een hamburgerknop.\n- Bovenaan: kop "Backlinks op echte Nederlandse sites", knop "Gratis registreren" (geen e-mailveld) en "Zo werkt het".\n- Daarnaast de marketplace zoals in het platform, live uit het platform via de plugin: 3 sites zichtbaar, de rest vervaagd met "Alle sites en prijzen zien? Registreer gratis".\n- Zo werkt het (3 stappen), Gemaakt voor seobureaus (met voorbeeldrapport), Veelgestelde vragen, en onderaan nog een keer Registreren.\n- Op mobiel blijft onderin altijd de knop "Gratis registreren" staan.\n- Geen rij met categorieën. De blog blijft op /blog en alle huidige adressen blijven werken.\n\nLet op: niet hetzelfde thema op de eigen blogsites gebruiken (Google ziet dan een netwerk). Linkgarantie en het rapport alleen tonen als ze gebouwd zijn.'
WHERE NOT EXISTS (SELECT 1 FROM "LaunchItem" WHERE "title" = 'Nieuw WordPress-thema voor nugevonden.nl');
