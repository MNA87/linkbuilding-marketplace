-- Planning: the restore test was done and passed.
UPDATE "LaunchItem"
SET "status" = 'done',
    "note" = concat_ws(E'\n\n', nullif("note", ''),
      'Getest op 12-10-2026: de back-up van 11:04 is in een tijdelijke database teruggezet: 32 tabellen, 517 rijen, alles compleet, in 15 seconden. De live database is niet aangeraakt. Herhalen kan met scripts/restore-test.ts (weigert elke database die niet leeg is).')
WHERE "list" = 'livegang' AND "title" = 'Back-up terugzetten testen' AND "status" <> 'done';
