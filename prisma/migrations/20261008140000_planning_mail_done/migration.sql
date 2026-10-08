-- Built (8-10-2026): mails around messages and orders by mail.
UPDATE "LaunchItem" SET "status" = 'done'
WHERE "list" = 'nice' AND "status" <> 'done' AND "title" IN (
  'Mail bij nieuw bericht',
  'Mail aan mij bij nieuwe bestelling per mail',
  'Binnengekomen: foutmelding Google Doc maar één keer',
  'Knop "Vraag klant om te delen" bij een Google Doc',
  'Meerdere Word-bestanden in één mail'
);
