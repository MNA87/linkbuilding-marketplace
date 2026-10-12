-- Planning: Sentry checked (it wasn't receiving anything); the platform now
-- mails the admins itself when something keeps going wrong.
UPDATE "LaunchItem"
SET "status" = 'done',
    "note" = concat_ws(E'\n\n', nullif("note", ''),
      'Gecontroleerd (12-10-2026): Sentry ontving niets (geen sleutel ingesteld). In plaats daarvan mailt het platform de admins zelf als er iets blijft misgaan: mail ophalen, "staat live"-mails, herinneringen, inplannen en fouten op pagina''s. Hooguit 10 mails per dag. Sentry kan er later alsnog bij (SENTRY_DSN in Railway).')
WHERE "list" = 'livegang' AND "title" = 'Sentry controleren' AND "status" <> 'done';
