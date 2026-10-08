-- Planning (9-10-2026): the phone card in the marketplace, to redesign with
-- fresh eyes. Several versions were tried; none was right yet.
INSERT INTO "LaunchItem" ("id", "list", "step", "title", "status", "position", "note")
SELECT gen_random_uuid()::text, 'nice', 0, 'Kaart in de marketplace (telefoon) opnieuw ontwerpen', 'todo',
  (SELECT coalesce(max("position"), 0) + 1 FROM "LaunchItem" WHERE "list" = 'nice'),
  E'De kaart per site op de telefoon oogt nog te zakelijk/kaal. Geprobeerd (8-10-2026): prijs rechtsboven, prijs bij de knop, letter-icoontjes; nog niet goed.\nWat er sowieso in moet:\n- "excl. btw" bij de prijs\n- bij korting of eigen prijs de standaardprijs doorgestreept ernaast\n- een knop die groot genoeg is voor een duim (minstens 40-44 pixels hoog)\n- geen icoontjes of letters per site\nStart: een screenshot van een kaart of lijst die je mooi vindt, en daar het gevoel van overnemen.'
WHERE NOT EXISTS (SELECT 1 FROM "LaunchItem" WHERE "title" = 'Kaart in de marketplace (telefoon) opnieuw ontwerpen');
