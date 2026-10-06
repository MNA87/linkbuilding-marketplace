-- Suggestions of 6-10-2026, on the Planning under "Nice to have", in the
-- suggested order.
INSERT INTO "LaunchItem" ("id", "list", "step", "title", "note", "status", "position")
SELECT gen_random_uuid()::text, 'nice', 0, t.title, t.note,
       'todo', COALESCE((SELECT MAX("position") FROM "LaunchItem" WHERE "list" = 'nice'), -1) + t.n
FROM (VALUES
  (1, '"Vandaag te doen" op het admin-dashboard',
   'Eén lijst: nieuwe mails in Binnengekomen, artikelen klaar om te publiceren, klanten die nog moeten aanleveren en links die bijna verlopen. Scheelt elke dag langs alle menu''s.'),
  (2, 'Teksteditor op telefoon compacter',
   'De knoppenbalk is op telefoon 3 rijen hoog. Alleen vet, kopje, lijst en link tonen; de rest achter een knop "Meer".'),
  (3, '"Categorie op de site" niet grijs',
   'Het keuzeveld in het bestelformulier ziet er grijs uit, alsof het niet te kiezen is. Gelijk maken aan de andere velden.'),
  (4, 'Binnengekomen: foutmelding Google Doc maar één keer',
   'Gaat een Google Doc niet open, dan staat de rode melding er nu twee keer.'),
  (5, 'Links na plaatsing automatisch controleren',
   'Regelmatig nakijken of elke geplaatste link nog online staat, en dat de klant laten zien ("Link actief ✓"). Seintje als een link verdwenen is.'),
  (6, 'Knop "Vraag klant om te delen" bij een Google Doc',
   'Gaat een Google Doc niet open, dan met één klik een nette mail naar de klant met uitleg hoe "Iedereen met de link" aan te zetten.'),
  (7, 'Meerdere Word-bestanden in één mail',
   'Net als bij Google Docs: elk Word-bestand een eigen aanvraag. En een duidelijke melding bij een oud .doc-bestand of een te groot bestand.'),
  (8, 'Favorieten voor klanten',
   'Klanten zetten sites op een eigen lijstje in de Marketplace en bestellen later in één keer.')
) AS t(n, title, note)
WHERE NOT EXISTS (SELECT 1 FROM "LaunchItem" WHERE "list" = 'nice' AND "title" = t.title);
