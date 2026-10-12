-- Planning: what is done and live (or done by the owner, like 2FA).
UPDATE "LaunchItem" SET "status" = 'done'
WHERE "list" = 'livegang' AND "status" <> 'done' AND "title" IN (
  'Mails en inlogscherm in één stijl',
  'Bestellingen per mail binnenhalen',
  'Verzamelfactuur',
  'Akkoord voorwaarden vastleggen',
  'Admin-inlog korter geldig (1 dag)',
  'Account op slot na 10 foute inlogpogingen',
  'Mail bij inloggen als admin',
  'Bedrijfsgegevens compleet',
  'Tweestapsverificatie voor admin'
);

UPDATE "LaunchItem" SET "status" = 'done'
WHERE "list" = 'nice' AND "status" <> 'done' AND "title" IN (
  'Registratie verklapt niet of e-mailadres al bestaat',
  'Factuur-e-mailadres bij afrekenen'
);

-- Customers who order by mail see the company name and e-mail address on
-- their invoice and in the preview mails.
UPDATE "LaunchItem"
SET "note" = concat_ws(E'\n\n', nullif("note", ''),
  'Let op: bedrijfsnaam en e-mailadres (Instellingen → Bedrijfsgegevens) bevatten nog "Nugevonden". Klanten die per mail bestellen zien die op hun factuur en in de preview-mails.')
WHERE "list" = 'livegang' AND "title" = 'Bedrijfsgegevens compleet'
  AND coalesce("note", '') NOT LIKE '%bevatten nog "Nugevonden"%';
