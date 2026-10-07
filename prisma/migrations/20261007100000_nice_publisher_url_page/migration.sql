-- The page behind "Plaatsings-URL doorgeven" (seen at BlogMatch, 7-10-2026),
-- added to the note of that Planning item.
UPDATE "LaunchItem"
SET "note" = "note" || E'\n\nDe pagina achter de knop (zonder inloggen): domein en gewenste datum bovenaan, één veld voor de URL van het geplaatste artikel en een knop "Opslaan". Melding dat de URL daarna vastligt en tot wanneer de link geldig is.\nBeter dan bij de concurrent: direct controleren of de URL op het goede domein staat en of de link van de klant er echt in staat, voordat hij wordt opgeslagen. Een foute URL kan de admin nog aanpassen.'
WHERE "list" = 'nice' AND "title" = 'Publishers: mail "Nieuw artikel klaar voor plaatsing"'
  AND "note" NOT LIKE '%De pagina achter de knop%';
