-- Planning (26-10-2026): "Eigen afbeelding uploaden" (Nice to have) is gebouwd.
-- Markeer als klaar en noteer wat er nu kan.
UPDATE "LaunchItem" SET "status" = 'done'
WHERE "list" = 'nice' AND "status" <> 'done' AND "title" = 'Eigen afbeelding uploaden';

UPDATE "LaunchItem"
SET "note" = concat_ws(E'\n\n', nullif("note", ''),
  E'Gebouwd: bij een artikel kies je een uitgelichte afbeelding via "Afbeelding zoeken" (Pixabay) of "Eigen afbeelding" uploaden (PNG/JPG/WEBP/GIF, max 2 MB), met een grote preview en Vervangen/Verwijderen. Eén gedeelde component voor het reguliere invulscherm en het bulk-popup. Om opslag te sparen wordt de lokale kopie een dag na publicatie opgeruimd (de foto staat dan al in de mediabibliotheek van de doelsite).')
WHERE "list" = 'nice' AND "title" = 'Eigen afbeelding uploaden'
  AND coalesce("note", '') NOT LIKE '%Gebouwd: bij een artikel kies je een uitgelichte afbeelding%';
