-- What the publisher sees after saving the URL (seen at BlogMatch, 7-10-2026).
UPDATE "LaunchItem"
SET "note" = "note" || E'\n\nNa opslaan: een groene melding "Plaatsings-URL ontvangen, bedankt" met de opgeslagen URL eronder. Bij ons ook: "Link gecontroleerd ✓" en wat er nu gebeurt (de klant krijgt bericht, de factuur wordt gemaakt).'
WHERE "list" = 'nice' AND "title" = 'Publishers: mail "Nieuw artikel klaar voor plaatsing"'
  AND "note" NOT LIKE '%Na opslaan:%';
