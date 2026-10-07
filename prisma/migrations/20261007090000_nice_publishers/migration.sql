-- For later, once outside publishers join (examples seen at BlogMatch,
-- 7-10-2026): on the Planning under "Nice to have".
INSERT INTO "LaunchItem" ("id", "list", "step", "title", "note", "status", "position")
SELECT gen_random_uuid()::text, 'nice', 0, t.title, t.note,
       'todo', COALESCE((SELECT MAX("position") FROM "LaunchItem" WHERE "list" = 'nice'), -1) + t.n
FROM (VALUES
  (1, 'Publishers: mail "Nieuw artikel klaar voor plaatsing"',
   'Voor als er publishers van buiten komen. Eén nette mail per artikel: domein, titel en gewenste datum, een knop "Artikel downloaden" (Word) en een knop "Plaatsings-URL doorgeven" die zonder inloggen werkt (link een tijd geldig). Herinnering als de URL na een paar dagen nog niet is doorgegeven.'),
  (2, 'Publishers: factureren',
   'In de mail aan de publisher staat aan wie en hoe ze factureren (bedrijfsnaam, adres, btw- en KvK-nummer, mailadres voor facturen). Beter nog: het platform maakt de factuur namens de publisher (self-billing), dan hoeft niemand iets te sturen. Eerst met de boekhouder bespreken.'),
  (3, 'Nieuwe accounts goedkeuren + welkomstmail',
   'Nieuwe publishers (en eventueel adverteerders) eerst laten goedkeuren door de admin. Daarna automatisch een mail "Je account is goedgekeurd" met het inlogadres en een knop "Inloggen".')
) AS t(n, title, note)
WHERE NOT EXISTS (SELECT 1 FROM "LaunchItem" WHERE "list" = 'nice' AND "title" = t.title);
