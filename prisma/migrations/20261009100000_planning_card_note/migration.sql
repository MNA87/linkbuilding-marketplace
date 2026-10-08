-- Planning (9-10-2026): no "excl. btw" and no struck-through price on the
-- card; the prices should line up on the phone.
UPDATE "LaunchItem"
SET "note" = E'De kaart per site op de telefoon oogt nog te zakelijk/kaal. Geprobeerd (8-10-2026): prijs rechtsboven, prijs bij de knop, letter-icoontjes; nog niet goed.\nWat er sowieso in moet:\n- de prijzen netjes onder elkaar uitgelijnd (nu begint elke prijs op een andere plek)\n- een knop die groot genoeg is voor een duim (minstens 40-44 pixels hoog)\n- geen icoontjes of letters per site\n- geen "excl. btw" en geen doorgestreepte prijs bij korting\nStart: een screenshot van een kaart of lijst die je mooi vindt, en daar het gevoel van overnemen.'
WHERE "title" = 'Kaart in de marketplace (telefoon) opnieuw ontwerpen';
