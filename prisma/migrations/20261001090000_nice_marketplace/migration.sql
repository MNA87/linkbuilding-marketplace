-- Ideas from the DigitalRise demo video (30-9-2026), see docs/nice-to-have/marketplace.md.
INSERT INTO "LaunchItem" ("id", "list", "step", "title", "status", "position")
SELECT gen_random_uuid()::text, 'nice', 0, t.title,
       'todo', COALESCE((SELECT MAX("position") FROM "LaunchItem" WHERE "list" = 'nice'), -1) + t.n
FROM (VALUES
  (1, 'Referentie bij bestellen'),
  (2, 'Filter op verkeer en label Snel online'),
  (3, 'In mandje tonen in de marketplace'),
  (4, 'Gesponsord-vermelding per site'),
  (5, 'Toestemmingsvinkjes bij bestellen'),
  (6, 'Regels van de uitgever per site'),
  (7, 'Prijs per onderwerp (casino, crypto, lening)'),
  (8, 'Exporteren naar Excel'),
  (9, 'Collega''s uitnodigen'),
  (10, 'Controle of de link nog live staat'),
  (11, 'Bulk bestellen via Excel'),
  (12, 'Factuur-e-mailadres bij afrekenen'),
  (13, 'Melding bij probleem met een order')
) AS t(n, title)
WHERE NOT EXISTS (SELECT 1 FROM "LaunchItem" WHERE "list" = 'nice' AND "title" = t.title);
